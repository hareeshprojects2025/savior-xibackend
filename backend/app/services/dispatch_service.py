import asyncio
import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Optional

from sqlalchemy.orm import Session

from app.core.config import BASE_URL, INBOUND_CALL_MAX_WAIT_SECONDS
from app.core.websocket import manager
from app.models.emergency import Emergency
from app.models.dispatch_record import DispatchRecord, DispatchStatus
from app.models.station import Station
from app.services.geospatial_service import get_district_for_emergency
from app.services.duplicate_service import check_duplicate, merge_duplicate, is_duplicate
from app.services.station_service import rank_stations, get_stations_by_type
from app.services.routing_service import compute_route
from app.services.sms_service import send_sms, build_location_sms
from app.services.message_service import (
    BolnaMessageService,
    SimulatedMessageService,
    MessageService,
    DispatchCallError,
)

logger = logging.getLogger("savior.dispatch")

# In-memory tracking for escalation timers (keyed by dispatch_record_id)
_escalation_timers: dict[int, asyncio.Task] = {}

# Default message service for MVP
_default_message_service: MessageService = BolnaMessageService()

ESCALATION_TIMEOUT_SECONDS = 600
SWEEP_INTERVAL_SECONDS = 60


def build_incident_dict(
    emergency: Emergency,
    record: Optional[DispatchRecord] = None,
    station: Optional[Station] = None,
) -> dict:
    """Build the incident payload passed to the Bolna outbound agent as user_data.
    Used for both first dispatch and escalation calls so every call carries full details."""
    incident = {
        "emergency_id": emergency.id,
        "dispatch_record_id": record.id if record else None,
        "emergency_type": emergency.emergency_type,
        "location": emergency.location,
        "description": emergency.description or "",
        "severity": emergency.severity or "",
        "victims": str(emergency.victims) if emergency.victims else "",
        "caller_name": emergency.caller_name or "",
        "summary": emergency.summary or "",
    }
    if station:
        incident["station_id"] = station.id
        incident["station_name"] = station.name
        incident["station_type"] = station.type
        incident["station_phone"] = station.phone or ""
    return incident


async def _send_dispatch_sms_fallback(station_phone: str, emergency: Emergency, record: DispatchRecord) -> bool:
    """SMS the station the dispatch details when Bolna call placement fails."""
    try:
        msg = (
            f"SAVIOR DISPATCH ALERT\n"
            f"Emergency #{emergency.id} - {emergency.emergency_type}\n"
            f"Location: {emergency.location}\n"
            f"Severity: {emergency.severity or 'N/A'}\n"
            f"Victims: {emergency.victims or 'N/A'}\n"
            f"Details: {emergency.description or 'N/A'}\n"
            f"Please acknowledge this dispatch with the SAVIOR dispatch center."
        )
        return await send_sms(station_phone, msg)
    except Exception as e:
        logger.error("Dispatch SMS fallback failed for emergency %d: %s", emergency.id, e)
        return False


async def run_validation_pipeline(db: Session, emergency: Emergency) -> dict:
    """Run validation steps after location is captured (or on creation if coords exist).
    
    Steps:
    1. District check (Shapely + GeoJSON)
    2. Duplicate check (SQL query)
    """
    result = {"district_check": None, "duplicate_check": None, "status": "validating"}

    emergency.pipeline_status = "validating"

    # District check (if coordinates exist)
    if emergency.latitude is not None and emergency.longitude is not None:
        district_info = get_district_for_emergency(emergency.latitude, emergency.longitude)
        emergency.district_check = district_info["district"]
        result["district_check"] = district_info

        if district_info["requires_manual_review"]:
            emergency.pipeline_status = "pending_manual_review"
            logger.info("Emergency %d outside coverage area — marked for manual review", emergency.id)
            db.commit()
            db.refresh(emergency)
            result["status"] = "pending_manual_review"
            return result

    # Duplicate check (if location string provided)
    if emergency.location:
        dup, existing = is_duplicate(db, emergency.location, emergency.emergency_type, emergency.created_at, exclude_id=emergency.id)
        result["duplicate_check"] = {"is_duplicate": dup, "existing_id": existing.id if existing else None}
        if dup and existing:
            logger.info("Emergency %d is a duplicate of emergency %d — merging", emergency.id, existing.id)
            # We don't merge here — the pipeline just flags it
            result["status"] = "duplicate_found"
            emergency.pipeline_status = "duplicate_found"
            db.commit()
            db.refresh(emergency)
            return result

    db.commit()
    db.refresh(emergency)
    result["status"] = "validated"
    emergency.pipeline_status = "validated"
    db.commit()
    db.refresh(emergency)
    return result


async def auto_run_full_pipeline(db: Session, emergency: Emergency) -> dict:
    """Fully automated pipeline: validate → rank → dispatch to top station.
    No dispatcher involvement needed. Returns final dispatch result.
    Any unexpected failure is caught and surfaced as dispatch_failed —
    never a silent stuck state."""
    try:
        return await _auto_run_full_pipeline_inner(db, emergency)
    except Exception as e:
        logger.exception("Auto-pipeline crashed for emergency %d: %s", emergency.id, e)
        try:
            emergency.pipeline_status = "dispatch_failed"
            db.commit()
        except Exception:
            pass
        try:
            await manager.broadcast({"type": "dispatch_failed", "emergency_id": emergency.id})
        except Exception:
            pass
        return {"status": "dispatch_failed", "message": f"Auto-pipeline error: {e}"}


async def _auto_run_full_pipeline_inner(db: Session, emergency: Emergency) -> dict:
    validation = await run_validation_pipeline(db, emergency)
    if validation.get("status") != "validated":
        logger.info("Auto-pipeline stopped at validation for emergency %d: %s", emergency.id, validation.get("status"))
        return validation

    rankings = await run_ranking_pipeline(db, emergency)
    if not rankings:
        logger.warning("Auto-pipeline: no stations found for emergency %d", emergency.id)
        emergency.pipeline_status = "dispatch_failed"
        db.commit()
        await manager.broadcast({"type": "dispatch_failed", "emergency_id": emergency.id})
        return {"status": "dispatch_failed", "message": "No stations available"}

    # Inbound-call gate: the victim is still on the line — validate + rank now,
    # but do NOT place the station call until the transcript-complete webhook
    # (or the lost-webhook timeout) releases the gate.
    if emergency.inbound_call_active:
        emergency.pipeline_status = "awaiting_call_complete"
        emergency.call_wait_deadline = datetime.now(timezone.utc) + timedelta(seconds=INBOUND_CALL_MAX_WAIT_SECONDS)
        db.commit()
        db.refresh(emergency)
        await manager.broadcast({
            "type": "dispatch_update",
            "emergency_id": emergency.id,
            "dispatch_status": "awaiting_call_complete",
            "rankings_available": len(rankings),
            "message": "Inbound call in progress — dispatch deferred until call ends",
        })
        logger.info("Emergency %d: inbound call live — dispatch deferred until call ends (wait=%ds)",
                    emergency.id, INBOUND_CALL_MAX_WAIT_SECONDS)
        return {"status": "awaiting_call_complete", "message": "Inbound call in progress"}

    top = rankings[0]
    result = await execute_dispatch(db, emergency.id, top["station"].id)
    if not result:
        logger.error("Auto-pipeline: dispatch failed for emergency %d to station %s", emergency.id, top["station"].name)
        emergency.pipeline_status = "dispatch_failed"
        db.commit()
        await manager.broadcast({"type": "dispatch_failed", "emergency_id": emergency.id})
        return {"status": "dispatch_failed", "message": "Dispatch execution failed"}

    # Log the chosen station with its full details so the operator can see, on
    # the console, exactly which station was selected and how to reach it.
    _s = top["station"]
    logger.info(
        "=== DISPATCHED (call ended): emergency=%d | dispatch_record=%s | station_id=%s | %s (%s) | phone=%s | address=%s | ETA=%.1f min | %.2f km ===",
        emergency.id,
        result.get("dispatch_id"),
        _s.id,
        _s.name,
        _s.type,
        _s.phone or "N/A",
        _s.address,
        top["eta_minutes"],
        top["distance_km"],
    )
    logger.info("Auto-pipeline complete for emergency %d: dispatched to %s (ETA %s min)",
                emergency.id, top["station"].name, top["eta_minutes"])
    return result


async def dispatch_after_call_end(db: Session, emergency: Emergency) -> dict | None:
    """Release the inbound-call gate and auto-dispatch once the caller's call has ended.

    Called from the transcript-complete webhook and from the lost-webhook sweep.
    Idempotent: refuses to run if a dispatch is already pending or acknowledged."""
    emergency.inbound_call_active = False
    emergency.call_wait_deadline = None
    db.commit()
    db.refresh(emergency)

    existing = (
        db.query(DispatchRecord)
        .filter(
            DispatchRecord.emergency_id == emergency.id,
            DispatchRecord.status.in_([DispatchStatus.pending_call, DispatchStatus.acknowledged]),
        )
        .first()
    )
    if existing:
        logger.info("Emergency %d already has active dispatch %d — skipping call-end trigger", emergency.id, existing.id)
        return {"status": "already_dispatched"}

    if emergency.latitude is None or emergency.longitude is None:
        logger.info("Emergency %d has no coordinates yet — waiting for location before dispatch", emergency.id)
        return {"status": "awaiting_location"}

    logger.info("Inbound call ended for emergency %d — auto-dispatching to top station", emergency.id)
    return await auto_run_full_pipeline(db, emergency)


async def run_ranking_pipeline(db: Session, emergency: Emergency) -> list[dict]:
    """Run station ranking after validation passes.
    Gets matching-type stations, computes routes concurrently, sorts by ETA, returns top 5."""
    if not emergency.latitude or not emergency.longitude:
        logger.warning("Emergency %d has no coordinates — cannot run ranking", emergency.id)
        return []

    rankings = await rank_stations(
        db,
        emergency.latitude,
        emergency.longitude,
        emergency.emergency_type,
        limit=5,
    )

    emergency.pipeline_status = "ranked"
    db.commit()
    db.refresh(emergency)

    # Broadcast ranking ready event
    await manager.broadcast({
        "type": "dispatch_update",
        "emergency_id": emergency.id,
        "dispatch_status": "ranked",
        "rankings_available": len(rankings),
    })

    logger.info("Emergency %d ranked: %d stations found", emergency.id, len(rankings))
    return rankings


async def execute_dispatch(
    db: Session,
    emergency_id: int,
    station_id: int,
    message_service: Optional[MessageService] = None,
) -> dict | None:
    """Execute dispatch when dispatcher confirms.
    Creates DispatchRecord, updates emergency status, triggers outbound call, starts escalation timer."""
    ms = message_service or _default_message_service

    emergency = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not emergency:
        logger.error("Emergency %d not found for dispatch", emergency_id)
        return None

    station = db.query(Station).filter(Station.id == station_id).first()
    if not station:
        logger.error("Station %d not found for dispatch", station_id)
        return None

    # Create DispatchRecord
    record = DispatchRecord(
        emergency_id=emergency_id,
        station_id=station_id,
        status=DispatchStatus.pending_call,
        dispatched_at=datetime.now(timezone.utc),
    )
    db.add(record)
    db.commit()
    db.refresh(record)

    # Update emergency status — stays "pending" until station ACKs
    emergency.pipeline_status = "pending_ack"
    emergency.dispatch_record_id = record.id
    db.commit()
    db.refresh(emergency)

    # Send dispatch notification via message service
    incident = build_incident_dict(emergency, record, station)
    call_id = None
    call_error = None

    if station.phone:
        try:
            call_id = await ms.send_dispatch(station.phone, incident)
            logger.info("Dispatch call placed: emergency=%d, station=%s, call_id=%s",
                        emergency_id, station.name, call_id)
        except DispatchCallError as e:
            call_error = str(e)
            logger.error("Dispatch call failed for emergency=%d, station=%s: %s",
                         emergency_id, station.name, e)
            record.call_status = "call_error"
            sms_sent = await _send_dispatch_sms_fallback(station.phone, emergency, record)
            db.commit()
            await manager.broadcast({
                "type": "dispatch_update",
                "emergency_id": emergency_id,
                "dispatch_record_id": record.id,
                "dispatch_status": "call_error",
                "station_id": station_id,
                "station_name": station.name,
                "call_status": "call_error",
                "message": "Call placement failed — SMS fallback sent" if sms_sent
                else "Call placement failed — manual dispatch required",
            })

    # Store call_id and escalation deadline on the dispatch record
    if call_id:
        record.call_id = call_id
        record.bolna_execution_id = ms.get_execution_id(call_id) or None
        record.ack_deadline = datetime.now(timezone.utc) + timedelta(seconds=ESCALATION_TIMEOUT_SECONDS)
        db.commit()

    if call_error:
        return {
            "dispatch_id": record.id,
            "emergency_id": emergency_id,
            "station_id": station_id,
            "status": "call_error",
            "message": "Bolna call placement failed",
        }

    # Start escalation timer (10-minute timeout)
    if call_id:
        _start_escalation_timer(record.id, call_id)

    # Broadcast dispatch event
    await manager.broadcast({
        "type": "dispatch_update",
        "emergency_id": emergency_id,
        "dispatch_status": "pending_ack",
        "station_id": station_id,
        "station_name": station.name,
    })

    return {
        "dispatch_id": record.id,
        "emergency_id": emergency_id,
        "station_id": station_id,
        "status": "pending_call",
        "message": f"Dispatch initiated to {station.name}",
    }


async def auto_trigger_dispatch_pipeline(db: Session, emergency: Emergency) -> None:
    """Called after emergency creation. Sends SMS with location link, starts pipeline."""
    # Send SMS with location capture link  
    # (duplicate check runs later in run_validation_pipeline, after district check)
    if emergency.caller_phone:
        phone, msg = build_location_sms(emergency.caller_phone, emergency.id, BASE_URL)
        sms_sent = await send_sms(phone, msg)
        if sms_sent:
            logger.info("Location SMS sent to %s for emergency %d", phone, emergency.id)
        else:
            logger.warning("Failed to send location SMS for emergency %d", emergency.id)

    # If coordinates already provided (e.g., from Bolna), run full auto pipeline
    if emergency.latitude is not None and emergency.longitude is not None:
        emergency.pipeline_status = "awaiting_validation"
        db.commit()
        db.refresh(emergency)
        await auto_run_full_pipeline(db, emergency)
    else:
        emergency.pipeline_status = "awaiting_location"
        db.commit()
        db.refresh(emergency)


async def resend_location_sms(db: Session, emergency: Emergency) -> bool:
    """Resend location SMS to the caller's phone. Used when caller_phone is corrected."""
    if not emergency.caller_phone:
        logger.warning("No caller_phone for emergency %d — cannot resend SMS", emergency.id)
        return False
    if emergency.latitude is not None and emergency.longitude is not None:
        logger.info("Emergency %d already has coordinates — skipping SMS resend", emergency.id)
        return False
    phone, msg = build_location_sms(emergency.caller_phone, emergency.id, BASE_URL)
    sent = await send_sms(phone, msg)
    if sent:
        logger.info("Location SMS resent to %s for emergency %d", phone, emergency.id)
    return sent


async def escalate_dispatch(
    db: Session,
    dispatch_record_id: int,
    message_service: Optional[MessageService] = None,
) -> dict | None:
    """Escalate to next station on ACK timeout or rejection.
    Race condition guard: only escalates if status is still 'pending_call'."""
    ms = message_service or _default_message_service

    current_record = db.query(DispatchRecord).filter(DispatchRecord.id == dispatch_record_id).first()
    if not current_record:
        logger.warning("Dispatch record %d not found for escalation", dispatch_record_id)
        return None

    # Race condition guard: atomic check-then-update
    if current_record.status != DispatchStatus.pending_call:
        logger.info("Dispatch %d already has status '%s' — skipping escalation",
                     dispatch_record_id, current_record.status.value)
        return None

    current_record.status = DispatchStatus.escalated
    db.commit()
    db.refresh(current_record)

    emergency = db.query(Emergency).filter(Emergency.id == current_record.emergency_id).first()
    if not emergency:
        logger.error("Emergency %d not found during escalation", current_record.emergency_id)
        return None

    # Find next station (all stations for this type, excluding already-escalated ones)
    all_stations = get_stations_by_type(db, emergency.emergency_type)
    used_station_ids = [
        r.station_id for r in db.query(DispatchRecord)
        .filter(
            DispatchRecord.emergency_id == emergency.id,
            DispatchRecord.status.in_([DispatchStatus.escalated, DispatchStatus.pending_call]),
        )
        .all()
    ]
    remaining = [s for s in all_stations if s.id not in used_station_ids]

    if not remaining:
        # All stations exhausted
        emergency.pipeline_status = "dispatch_failed"
        db.commit()
        db.refresh(emergency)
        await manager.broadcast({
            "type": "dispatch_failed",
            "emergency_id": emergency.id,
        })
        logger.error("All stations exhausted for emergency %d — dispatch_failed", emergency.id)
        return {"status": "dispatch_failed", "message": "All stations exhausted"}

    # Find next station with routing (for ranking)
    next_stations = await rank_stations(
        db,
        emergency.latitude or 0,
        emergency.longitude or 0,
        emergency.emergency_type,
        limit=len(remaining),
    )
    next_station_data = next_stations[0] if next_stations else None
    if not next_station_data:
        emergency.pipeline_status = "dispatch_failed"
        db.commit()
        await manager.broadcast({"type": "dispatch_failed", "emergency_id": emergency.id})
        return {"status": "dispatch_failed", "message": "No reachable stations"}

    next_station = next_station_data["station"]

    # Create new dispatch record for next station
    new_record = DispatchRecord(
        emergency_id=emergency.id,
        station_id=next_station.id,
        status=DispatchStatus.pending_call,
        dispatched_at=datetime.now(timezone.utc),
    )
    db.add(new_record)
    db.commit()
    db.refresh(new_record)

    emergency.dispatch_record_id = new_record.id
    emergency.pipeline_status = "escalated"
    db.commit()

    # Send fresh dispatch with full incident details (D-34)
    incident = build_incident_dict(emergency, new_record, next_station)
    if next_station.phone:
        try:
            call_id = await ms.send_dispatch(next_station.phone, incident)
        except DispatchCallError as e:
            call_id = None
            logger.error("Escalation call failed for emergency=%d, station=%s: %s",
                         emergency.id, next_station.name, e)
            new_record.call_status = "call_error"
            sms_sent = await _send_dispatch_sms_fallback(next_station.phone, emergency, new_record)
            await manager.broadcast({
                "type": "dispatch_update",
                "emergency_id": emergency.id,
                "dispatch_record_id": new_record.id,
                "dispatch_status": "call_error",
                "station_id": next_station.id,
                "station_name": next_station.name,
                "call_status": "call_error",
                "message": "Escalation call failed — SMS fallback sent" if sms_sent
                else "Escalation call failed — manual dispatch required",
            })

        if call_id:
            new_record.call_id = call_id
            new_record.bolna_execution_id = ms.get_execution_id(call_id) or None
            new_record.ack_deadline = datetime.now(timezone.utc) + timedelta(seconds=ESCALATION_TIMEOUT_SECONDS)
            db.commit()
            _start_escalation_timer(new_record.id, call_id)

    await manager.broadcast({
        "type": "dispatch_escalated",
        "emergency_id": emergency.id,
        "previous_station_id": current_record.station_id,
        "next_station_id": next_station.id,
    })

    logger.info("Escalated emergency %d: station %s -> %s",
                emergency.id, current_record.station_id, next_station.id)
    return {
        "dispatch_id": new_record.id,
        "station_id": next_station.id,
        "status": "escalated",
    }


def _start_escalation_timer(dispatch_record_id: int, call_id: str) -> None:
    """Start a background asyncio task that escalates after 600 seconds if no ACK.
    The ack_deadline is persisted on the record so a restart-safe sweep can recover it."""
    if call_id.startswith("sim_"):
        # In simulated mode, skip the actual timer — dispatcher manually confirms ACK
        return

    async def _timer():
        await asyncio.sleep(ESCALATION_TIMEOUT_SECONDS)  # 10-minute timeout for agent to complete
        # Import here to avoid circular dependency at module level
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            record = db.query(DispatchRecord).filter(DispatchRecord.id == dispatch_record_id).first()
            if not record or record.status == DispatchStatus.acknowledged:
                return

            # Route through escalate_dispatch so a no-response timeout behaves the
            # same as the restart sweep and an explicit rejection: mark this record
            # escalated, create a pending_call for the next station, and place the call.
            # escalate_dispatch only advances while status is still pending_call.
            logger.info("Escalation timer fired for dispatch %d — failing over to next station", dispatch_record_id)
            await escalate_dispatch(db, dispatch_record_id)
        except Exception as e:
            logger.error("Escalation timer error for dispatch %d: %s", dispatch_record_id, e)
        finally:
            db.close()

    task = asyncio.create_task(_timer())
    _escalation_timers[dispatch_record_id] = task
    logger.debug("Escalation timer started for dispatch %d (call_id=%s)", dispatch_record_id, call_id)


def cancel_escalation(dispatch_record_id: int) -> bool:
    """Cancel a pending escalation timer for a dispatch record.
    Returns True if a timer was found and cancelled."""
    task = _escalation_timers.pop(dispatch_record_id, None)
    if task and not task.done():
        task.cancel()
        logger.info("Escalation timer cancelled for dispatch %d", dispatch_record_id)
        return True
    return False


async def _run_escalation_sweep_once() -> None:
    """Escalate any pending_call dispatch whose ack_deadline has passed.
    Recovery path for timers lost across restarts. Simulated calls are skipped."""
    from app.core.database import SessionLocal

    try:
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            overdue = (
                db.query(DispatchRecord)
                .filter(
                    DispatchRecord.status == DispatchStatus.pending_call,
                    DispatchRecord.ack_deadline.isnot(None),
                    DispatchRecord.ack_deadline < now,
                )
                .all()
            )
            for record in overdue:
                if record.call_id and record.call_id.startswith("sim_"):
                    continue
                logger.info("Escalation sweep: escalating overdue dispatch %d", record.id)
                try:
                    await escalate_dispatch(db, record.id)
                except Exception as e:
                    logger.error("Escalation sweep failed for dispatch %d: %s", record.id, e)
        finally:
            db.close()
    except Exception as e:
        logger.error("Escalation sweep error: %s", e)


async def _run_call_wait_sweep_once() -> None:
    """Release emergencies stuck on the inbound-call gate past call_wait_deadline
    (transcript-complete webhook lost). Fail-open — never delay an emergency."""
    from app.core.database import SessionLocal

    try:
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            stuck = (
                db.query(Emergency)
                .filter(
                    Emergency.inbound_call_active.is_(True),
                    Emergency.call_wait_deadline.isnot(None),
                    Emergency.call_wait_deadline < now,
                )
                .all()
            )
            for emergency in stuck:
                logger.warning("Lost transcript-complete webhook for emergency %d — releasing dispatch gate", emergency.id)
                try:
                    await dispatch_after_call_end(db, emergency)
                except Exception as e:
                    logger.error("Call-wait release failed for emergency %d: %s", emergency.id, e)
        finally:
            db.close()
    except Exception as e:
        logger.error("Call-wait sweep error: %s", e)


STUCK_PIPELINE_RETRY_SECONDS = 120


async def _run_stuck_pipeline_sweep_once() -> None:
    """Recover emergencies left in 'validating' by a crash mid-pipeline.

    Matches the observed failure mode: validation committed ('validating'
    persisted) but ranking/dispatch never ran — no dispatch record, no
    dispatch_failed. Only touches emergencies whose inbound call has ended
    and that have been sitting in validating for a while."""
    from app.core.database import SessionLocal

    try:
        db = SessionLocal()
        try:
            now = datetime.now(timezone.utc)
            cutoff = now - timedelta(seconds=STUCK_PIPELINE_RETRY_SECONDS)
            no_active_record = ~db.query(DispatchRecord.id).filter(
                DispatchRecord.emergency_id == Emergency.id,
                DispatchRecord.status.in_([DispatchStatus.pending_call, DispatchStatus.acknowledged]),
            ).exists()
            stuck = (
                db.query(Emergency)
                .filter(
                    Emergency.pipeline_status == "validating",
                    Emergency.inbound_call_active.is_(False),
                    Emergency.created_at < cutoff,
                    no_active_record,
                )
                .all()
            )
            for emergency in stuck:
                logger.warning("Stuck emergency %d in 'validating' — retrying auto-dispatch", emergency.id)
                try:
                    recovered = await dispatch_after_call_end(db, emergency)
                    if recovered and recovered.get("status") == "awaiting_location":
                        # Coords never arrived — move to the accurate state instead
                        # of leaving it stuck in 'validating' forever.
                        emergency.pipeline_status = "awaiting_location"
                        db.commit()
                        logger.info("Stuck emergency %d moved to awaiting_location", emergency.id)
                except Exception as e:
                    logger.error("Stuck-pipeline retry failed for emergency %d: %s", emergency.id, e)
        finally:
            db.close()
    except Exception as e:
        logger.error("Stuck-pipeline sweep error: %s", e)


def start_escalation_sweep() -> asyncio.Task:
    """Start the background sweep loop (immediate first pass, then periodic).
    Handles both ACK-timeout escalation and inbound-call gate release."""

    async def _sweep_loop():
        while True:
            await _run_escalation_sweep_once()
            await _run_call_wait_sweep_once()
            await _run_stuck_pipeline_sweep_once()
            await asyncio.sleep(SWEEP_INTERVAL_SECONDS)

    task = asyncio.create_task(_sweep_loop())
    logger.info("Escalation sweep started (interval=%ds, timeout=%ds)",
                SWEEP_INTERVAL_SECONDS, ESCALATION_TIMEOUT_SECONDS)
    return task
