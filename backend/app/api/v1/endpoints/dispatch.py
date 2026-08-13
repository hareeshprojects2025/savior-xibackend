import json
import logging

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session

from app.core.config import BOLNA_WEBHOOK_SECRET
from app.core.database import get_db
from app.core.websocket import manager
from app.schemas.dispatch import DispatchRequest, DispatchResponse, DispatchRecordOut, AckWebhookBody
from app.schemas.station import StationRankingOut
from app.services.dispatch_service import (
    run_ranking_pipeline,
    execute_dispatch,
    escalate_dispatch,
    cancel_escalation,
)
from app.services.emergency_service import get_emergency
from app.models.emergency import Emergency
from app.models.dispatch_record import DispatchRecord, DispatchStatus
from app.models.station import Station

logger = logging.getLogger("savior.dispatch.api")

router = APIRouter(tags=["Dispatch"])


@router.get("/emergencies/{emergency_id}/stations", response_model=list[StationRankingOut])
async def get_station_rankings(emergency_id: int, db: Session = Depends(get_db)):
    """Get ranked stations for an emergency. Runs ranking pipeline if not yet ranked."""
    emergency = get_emergency(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    rankings = await run_ranking_pipeline(db, emergency)

    # Convert to Pydantic response models
    result = []
    for r in rankings:
        station = r["station"]
        result.append(StationRankingOut(
            station=station,
            distance_km=r["distance_km"],
            eta_minutes=r["eta_minutes"],
            encoded_polyline=r["encoded_polyline"],
        ))
    return result


@router.post("/emergencies/{emergency_id}/dispatch", response_model=DispatchResponse)
async def confirm_dispatch(
    emergency_id: int,
    request: DispatchRequest,
    db: Session = Depends(get_db),
):
    """Dispatcher confirms dispatch to a specific station."""
    emergency = get_emergency(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    # Hard block: no manual dispatch while the inbound caller call is still live
    if emergency.inbound_call_active:
        raise HTTPException(
            status_code=423,
            detail="Caller is still on the line — dispatch is locked until the call ends",
        )

    result = await execute_dispatch(db, emergency_id, request.station_id)
    if not result:
        raise HTTPException(status_code=400, detail="Dispatch failed")

    if result["status"] == "call_error":
        raise HTTPException(
            status_code=502,
            detail="Bolna call placement failed — SMS fallback sent to station",
        )

    await manager.broadcast({
        "type": "dispatch_update",
        "emergency_id": emergency_id,
        "dispatch_status": result["status"],
        "station_id": request.station_id,
    })

    return DispatchResponse(
        status=result["status"],
        dispatch_id=result["dispatch_id"],
        message=result["message"],
    )


@router.get("/emergencies/{emergency_id}/dispatch/status")
async def get_dispatch_status(emergency_id: int, db: Session = Depends(get_db)):
    """Get current dispatch status for an emergency."""
    record = (
        db.query(DispatchRecord)
        .filter(DispatchRecord.emergency_id == emergency_id)
        .order_by(DispatchRecord.created_at.desc())
        .first()
    )
    if not record:
        raise HTTPException(status_code=404, detail="No dispatch record found for this emergency")

    return DispatchRecordOut.model_validate(record)


@router.post("/dispatch/ack")
async def dispatch_ack_webhook(
    request: Request,
    db: Session = Depends(get_db),
):
    """Webhook endpoint for Bolna station ACK (D-31, D-32, D-33).
    Accepts raw dict to handle any Bolna webhook format."""
    # Shared-secret auth — reject webhooks that don't carry the expected token
    if BOLNA_WEBHOOK_SECRET:
        auth = request.headers.get("Authorization", "")
        if auth != f"Bearer {BOLNA_WEBHOOK_SECRET}":
            logger.warning(
                "ACK auth mismatch | header_present=%s | len=%d | starts_with_bearer=%s | equals_expected=%s | incoming_headers=%s",
                bool(auth), len(auth), auth.startswith("Bearer "),
                auth == f"Bearer {BOLNA_WEBHOOK_SECRET}",
                list(request.headers.keys()),
            )
            raise HTTPException(status_code=401, detail="Unauthorized")

    raw_body = await request.json()
    logger.info("ACK webhook raw body: %s", json.dumps(raw_body)[:1000])

    # Bolna sends webhooks in varied formats — normalize field names
    dispatch_record_id = (
        raw_body.get("dispatch_record_id")
        or raw_body.get("dispatchId")
        or raw_body.get("call_data", {}).get("dispatch_record_id")
        or raw_body.get("user_data", {}).get("dispatch_record_id")
        or raw_body.get("metadata", {}).get("dispatch_record_id")
    )
    call_id = raw_body.get("call_id") or raw_body.get("callId") or raw_body.get("id", "")
    emergency_id = raw_body.get("emergency_id") or raw_body.get("user_data", {}).get("emergency_id")
    ack_status = (
        raw_body.get("ack_status")
        or raw_body.get("ackStatus")
        or raw_body.get("status")
        or raw_body.get("call_status")
        or raw_body.get("call_data", {}).get("ack_status")
        or raw_body.get("user_data", {}).get("ack_status")
        or ""
    )

    logger.info("ACK webhook parsed: dispatch_record_id=%s, call_id=%s, emergency_id=%s, ack_status=%s",
                dispatch_record_id, call_id, emergency_id, ack_status)

    record = None
    try:
        did = int(dispatch_record_id)
        record = db.query(DispatchRecord).filter(DispatchRecord.id == did).first()
    except (ValueError, TypeError):
        pass

    # Fallback: match by call_id if dispatch_record_id didn't resolve
    # (matches both the stored call_id and the Bolna execution UUID)
    if not record and call_id:
        record = (
            db.query(DispatchRecord)
            .filter(
                DispatchRecord.call_id == call_id,
            )
            .first()
        ) or (
            db.query(DispatchRecord)
            .filter(DispatchRecord.bolna_execution_id == call_id)
            .first()
        )
        if record:
            logger.info("Matched dispatch %d by call_id=%s", record.id, call_id)

    # Fallback: match by emergency_id — the latest dispatch record for the
    # emergency (station_ack_response always carries emergency_id)
    if not record and emergency_id:
        try:
            eid = int(emergency_id)
            record = (
                db.query(DispatchRecord)
                .filter(DispatchRecord.emergency_id == eid)
                .order_by(DispatchRecord.created_at.desc())
                .first()
            )
            if record:
                logger.info("Matched dispatch %d by emergency_id=%s", record.id, eid)
        except (ValueError, TypeError):
            pass

    if not record:
        # Orphan ACK: no dispatch record at all. Surface it loudly and attempt
        # one fail-open recovery for a stuck emergency before giving up.
        resolved_emergency = None
        if emergency_id:
            try:
                resolved_emergency = db.query(Emergency).filter(Emergency.id == int(emergency_id)).first()
            except (ValueError, TypeError):
                pass

        if resolved_emergency and not resolved_emergency.inbound_call_active:
            try:
                from app.services.dispatch_service import dispatch_after_call_end
                recovered = await dispatch_after_call_end(db, resolved_emergency)
                if recovered and recovered.get("status") not in ("already_dispatched", "awaiting_location"):
                    logger.info("Orphan ACK triggered recovery dispatch for emergency %d: %s",
                                resolved_emergency.id, recovered.get("status"))
            except Exception as e:
                logger.error("Orphan ACK recovery failed for emergency %s: %s", emergency_id, e)

        import asyncio as _asyncio
        _asyncio.create_task(manager.broadcast({
            "type": "orphan_dispatch_ack",
            "emergency_id": int(emergency_id) if emergency_id else None,
            "call_id": call_id,
            "ack_status": ack_status,
            "message": "ACK webhook received but no dispatch record matched — operator attention required",
        }))
        logger.error("Orphan ACK webhook — no dispatch record found (dispatch_record_id=%s, call_id=%s, emergency_id=%s, ack_status=%s)",
                     dispatch_record_id, call_id, emergency_id, ack_status)
        return {"status": "ignored", "reason": "Dispatch record not found — orphan ack broadcast"}

    # Derive station name server-side from the record — never trust the LLM for identity
    station = db.query(Station).filter(Station.id == record.station_id).first()
    station_name = station.name if station else ""

    # Race condition guard: only update if still pending_call
    if record.status.value != "pending_call":
        logger.info("Dispatch %d already has status='%s' — ignoring webhook", dispatch_record_id, record.status.value)
        return {"status": "ignored", "reason": f"Already {record.status.value}"}

    if ack_status == "acknowledged":
        record.status = DispatchStatus.acknowledged
        record.acknowledged_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
        db.commit()
        db.refresh(record)

        # Cancel escalation timer (by the resolved record id — the raw
        # dispatch_record_id may be None when matched via call_id/emergency_id)
        cancel_escalation(record.id)

        # Update emergency status
        from app.services.emergency_service import get_emergency as ge
        emergency = ge(db, record.emergency_id)
        if emergency:
            emergency.status = "dispatched"
            emergency.pipeline_status = "dispatched"
            db.commit()

            # Broadcast acknowledgment
            import asyncio
            asyncio.create_task(manager.broadcast({
                "type": "dispatch_update",
                "emergency_id": record.emergency_id,
                "dispatch_status": "acknowledged",
                "station_id": record.station_id,
                "station_name": station_name,
            }))

        logger.info("Dispatch %d acknowledged by station %s", dispatch_record_id, station_name)
        return {"status": "acknowledged"}

    elif ack_status in ("rejected", "no_answer", "declined", "failed"):
        # Station did not take it — auto fail over to the next station, matching
        # the timeout/sweep path. escalate_dispatch guards on pending_call and
        # handles all-stations-exhausted (sets dispatch_failed).
        logger.info("Dispatch %d refused (%s) — escalating to next station", record.id, ack_status)
        result = await escalate_dispatch(db, record.id)
        return {
            "status": "escalated" if result else "dispatch_failed",
            "reason": ack_status,
        }

    elif ack_status == "needs_clarification":
        # Details were unclear — keep for manual operator review, no auto redispatch.
        record.status = DispatchStatus.escalated
        db.commit()

        from app.services.emergency_service import get_emergency as ge
        emergency = ge(db, record.emergency_id)
        if emergency:
            emergency.pipeline_status = "awaiting_redispatch"
            db.commit()

            import asyncio
            asyncio.create_task(manager.broadcast({
                "type": "dispatch_update",
                "emergency_id": record.emergency_id,
                "dispatch_status": "awaiting_redispatch",
                "station_id": record.station_id,
                "station_name": station_name,
                "message": "Station requested clarification — manual review",
            }))

        logger.info("Dispatch %d awaiting redispatch (needs_clarification)", dispatch_record_id)
        return {"status": "awaiting_redispatch"}

    logger.info("Unknown ACK status '%s' for dispatch %d — ignoring", ack_status, dispatch_record_id)
    return {"status": "unknown_ack_status", "ack_status": ack_status}
