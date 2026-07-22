import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Callable, Optional

from sqlalchemy.orm import Session

from app.core.config import BASE_URL
from app.core.websocket import manager
from app.models.emergency import Emergency
from app.models.dispatch_record import DispatchRecord, DispatchStatus
from app.models.station import Station
from app.services.geospatial_service import get_district_for_emergency
from app.services.duplicate_service import check_duplicate, merge_duplicate, is_duplicate
from app.services.station_service import rank_stations, get_stations_by_type
from app.services.routing_service import compute_route
from app.services.sms_service import send_sms, build_location_sms
from app.services.message_service import BolnaMessageService, SimulatedMessageService, MessageService

logger = logging.getLogger("savior.dispatch")

# In-memory tracking for escalation timers (keyed by dispatch_record_id)
_escalation_timers: dict[int, asyncio.Task] = {}

# Default message service for MVP
_default_message_service: MessageService = BolnaMessageService()


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
    return result


async def auto_run_full_pipeline(db: Session, emergency: Emergency) -> dict:
    """Fully automated pipeline: validate → rank → dispatch to top station.
    No dispatcher involvement needed. Returns final dispatch result."""
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

    top = rankings[0]
    result = await execute_dispatch(db, emergency.id, top["station"].id)
    if not result:
        logger.error("Auto-pipeline: dispatch failed for emergency %d to station %s", emergency.id, top["station"].name)
        emergency.pipeline_status = "dispatch_failed"
        db.commit()
        await manager.broadcast({"type": "dispatch_failed", "emergency_id": emergency.id})
        return {"status": "dispatch_failed", "message": "Dispatch execution failed"}

    logger.info("Auto-pipeline complete for emergency %d: dispatched to %s (ETA %s min)",
                emergency.id, top["station"].name, top["eta_minutes"])
    return result


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
    incident = {
        "emergency_id": emergency.id,
        "dispatch_record_id": record.id,
        "emergency_type": emergency.emergency_type,
        "location": emergency.location,
        "description": emergency.description or "",
        "severity": emergency.severity or "",
        "victims": str(emergency.victims) if emergency.victims else "",
        "caller_name": emergency.caller_name or "",
        "summary": emergency.summary or "",
    }
    call_id = None
    if station.phone:
        call_id = await ms.send_dispatch(station.phone, incident)
        logger.info("Dispatch call placed: emergency=%d, station=%s, call_id=%s",
                     emergency_id, station.name, call_id)



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

    # Send fresh dispatch with no escalation context (D-34)
    incident = {
        "emergency_id": emergency.id,
        "emergency_type": emergency.emergency_type,
        "location": emergency.location,
        "description": emergency.description or "",
    }
    if next_station.phone:
        call_id = await ms.send_dispatch(next_station.phone, incident)
        _start_escalation_timer(new_record.id, call_id or "")

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
    """Start a background asyncio task that escalates after 600 seconds if no ACK."""
    if call_id.startswith("sim_"):
        # In simulated mode, skip the actual timer — dispatcher manually confirms ACK
        return

    async def _timer():
        await asyncio.sleep(600)  # 10-minute timeout for agent to complete
        # Import here to avoid circular dependency at module level
        from app.core.database import SessionLocal
        db = SessionLocal()
        try:
            record = db.query(DispatchRecord).filter(DispatchRecord.id == dispatch_record_id).first()
            if not record or record.status == DispatchStatus.acknowledged:
                return

            record.status = DispatchStatus.escalated
            db.commit()

            emergency = db.query(Emergency).filter(Emergency.id == record.emergency_id).first()
            if emergency:
                if emergency.pipeline_status != "pending_ack":
                    return
                emergency.pipeline_status = "awaiting_redispatch"
                db.commit()
                await manager.broadcast({
                    "type": "dispatch_update",
                    "emergency_id": emergency.id,
                    "dispatch_status": "awaiting_redispatch",
                    "station_id": record.station_id,
                    "message": "Station did not respond",
                })

            logger.info("Escalation timer fired for dispatch %d — awaiting redispatch", dispatch_record_id)
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
