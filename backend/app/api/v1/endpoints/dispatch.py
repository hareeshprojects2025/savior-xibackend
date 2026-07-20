import logging

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

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
from app.models.dispatch_record import DispatchRecord, DispatchStatus
from app.services.message_service import BolnaMessageService

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

    result = await execute_dispatch(db, emergency_id, request.station_id)
    if not result:
        raise HTTPException(status_code=400, detail="Dispatch failed")

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
    body: AckWebhookBody,
    db: Session = Depends(get_db),
):
    """Webhook endpoint for Bolna station ACK (D-31, D-32, D-33)."""
    logger.info("ACK webhook received: dispatch_record_id=%s, call_id=%s, ack_status=%s",
                body.dispatch_record_id, body.call_id, body.ack_status)

    try:
        dispatch_record_id = int(body.dispatch_record_id)
    except (ValueError, TypeError):
        logger.warning("Invalid dispatch_record_id: %s — ignoring webhook", body.dispatch_record_id)
        return {"status": "ignored", "reason": f"Invalid dispatch_record_id: {body.dispatch_record_id}"}

    record = db.query(DispatchRecord).filter(DispatchRecord.id == dispatch_record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Dispatch record not found")

    # Race condition guard: only update if still pending_call
    if record.status.value != "pending_call":
        logger.info("Dispatch %d already has status='%s' — ignoring webhook", dispatch_record_id, record.status.value)
        return {"status": "ignored", "reason": f"Already {record.status.value}"}

    if body.ack_status == "acknowledged":
        record.status = "acknowledged"
        record.acknowledged_at = __import__("datetime").datetime.now(__import__("datetime").timezone.utc)
        db.commit()
        db.refresh(record)

        # Cancel escalation timer
        cancel_escalation(dispatch_record_id)

        # Update emergency status
        emergency = __import__("app.services.emergency_service", fromlist=["get_emergency"]).get_emergency(db, record.emergency_id)
        if emergency:
            emergency.status = "dispatched"  # type: ignore[assignment]
            emergency.pipeline_status = "dispatched"
            db.commit()

            # Store ACK in BolnaMessageService for polling
            bolna_service = BolnaMessageService()
            bolna_service.process_webhook(body.call_id, body.ack_status)

            # Broadcast acknowledgment
            import asyncio
            asyncio.create_task(manager.broadcast({
                "type": "dispatch_update",
                "emergency_id": record.emergency_id,
                "dispatch_status": "acknowledged",
                "station_id": record.station_id,
            }))

        logger.info("Dispatch %d acknowledged by station %d", dispatch_record_id, record.station_id)
        return {"status": "acknowledged"}

    elif body.ack_status in ("rejected", "no_answer", "needs_clarification"):
        # Mark escalated + await redispatch
        record.status = DispatchStatus.escalated
        db.commit()

        emergency = __import__("app.services.emergency_service", fromlist=["get_emergency"]).get_emergency(db, record.emergency_id)
        if emergency:
            emergency.pipeline_status = "awaiting_redispatch"
            db.commit()

            import asyncio
            asyncio.create_task(manager.broadcast({
                "type": "dispatch_update",
                "emergency_id": record.emergency_id,
                "dispatch_status": "awaiting_redispatch",
                "station_id": record.station_id,
                "message": "Station did not respond",
            }))

        logger.info("Dispatch %d awaiting redispatch: %s", dispatch_record_id, body.ack_status)
        return {"status": "awaiting_redispatch"}

    return {"status": "unknown_ack_status", "ack_status": body.ack_status}
