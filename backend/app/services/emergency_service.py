import asyncio
import logging
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.models.emergency import Emergency
from app.schemas.emergency import EmergencyCreate, EmergencyUpdate, EmergencyStatus
from app.core.websocket import manager
from app.services.geocoding_service import geocode_location

logger = logging.getLogger("savior.emergency")


def _apply_geocoding(record: Emergency, result: dict) -> None:
    record.latitude = result["lat"]
    record.longitude = result["lng"]
    record.geocoded_place_name = result.get("place_name")
    record.geocoded_osm_type = result.get("osm_type")
    record.geocoded_osm_key = result.get("osm_key")
    record.geocoded_city = result.get("city")
    record.geocoded_state = result.get("state")


async def create_emergency(db: Session, data: EmergencyCreate, background_geocode: bool = False) -> Emergency:
    record = Emergency(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)

    if background_geocode:
        # Fire-and-forget geocoding + pipeline (returns immediately)
        asyncio.create_task(_geocode_and_pipeline(record.id, data.location, data.landmark))
    else:
        # Sync mode: geocode then pipeline
        if record.latitude is None and record.longitude is None and record.location:
            result = await geocode_location(record.location, record.landmark)
            if result:
                _apply_geocoding(record, result)
                db.commit()
                db.refresh(record)

        try:
            from app.services.dispatch_service import auto_trigger_dispatch_pipeline
            await auto_trigger_dispatch_pipeline(db, record)
        except Exception as e:
            logger.error("Dispatch pipeline trigger failed for emergency %d: %s", record.id, e)

    return record


async def _geocode_and_pipeline(emergency_id: int, location: str, landmark: str | None) -> None:
    """Background task: geocode and run pipeline for a newly created emergency."""
    from app.core.database import SessionLocal
    from app.services.dispatch_service import auto_trigger_dispatch_pipeline

    try:
        result = await geocode_location(location, landmark)
        db = SessionLocal()
        try:
            record = db.query(Emergency).filter(Emergency.id == emergency_id).first()
            if not record:
                logger.warning("Emergency %d not found for background geocoding", emergency_id)
                return
            if result:
                _apply_geocoding(record, result)
                db.commit()
                db.refresh(record)

            await auto_trigger_dispatch_pipeline(db, record)
        finally:
            db.close()
    except Exception as e:
        logger.error("Background geocode/pipeline failed for emergency %d: %s", emergency_id, e)


def get_emergencies(db: Session) -> list[Emergency]:
    return db.query(Emergency).order_by(Emergency.created_at.desc()).all()


def get_emergency(db: Session, emergency_id: int) -> Emergency | None:
    return db.query(Emergency).filter(Emergency.id == emergency_id).first()


def get_recent_emergencies(db: Session, limit: int = 10, offset: int = 0, in_coverage: bool = False) -> list[Emergency]:
    q = db.query(Emergency).order_by(Emergency.created_at.desc())
    if in_coverage:
        q = q.filter(Emergency.pipeline_status != "pending_manual_review")
    return q.offset(offset).limit(limit).all()


def get_emergencies_by_severity(db: Session, severity: str) -> list[Emergency]:
    return (
        db.query(Emergency)
        .filter(Emergency.severity == severity)
        .order_by(Emergency.created_at.desc())
        .all()
    )


def get_emergencies_by_type(db: Session, emergency_type: str) -> list[Emergency]:
    return (
        db.query(Emergency)
        .filter(Emergency.emergency_type == emergency_type)
        .order_by(Emergency.created_at.desc())
        .all()
    )


def get_emergencies_by_location(db: Session, location: str) -> list[Emergency]:
    return (
        db.query(Emergency)
        .filter(Emergency.location.like(f"%{location}%"))
        .order_by(Emergency.created_at.desc())
        .all()
    )


def get_emergencies_by_date(db: Session, target_date: date) -> list[Emergency]:
    start_dt = datetime.combine(target_date, datetime.min.time())
    end_dt = start_dt + timedelta(days=1)
    return (
        db.query(Emergency)
        .filter(Emergency.created_at >= start_dt, Emergency.created_at < end_dt)
        .order_by(Emergency.created_at.desc())
        .all()
    )


def get_mass_casualty_emergencies(db: Session, min_victims: int = 10) -> list[Emergency]:
    return (
        db.query(Emergency)
        .filter(Emergency.victims >= min_victims)
        .order_by(Emergency.created_at.desc())
        .all()
    )


def get_emergency_stats(db: Session, days: int | None = None, today: bool = False) -> dict:
    q = db.query(Emergency)
    if today:
        IST_OFFSET = timedelta(hours=5, minutes=30)
        now_ist = datetime.now(timezone.utc) + IST_OFFSET
        today_start_ist = now_ist.replace(hour=0, minute=0, second=0, microsecond=0)
        today_start_utc = today_start_ist - IST_OFFSET
        q = q.filter(Emergency.created_at >= today_start_utc)
    elif days is not None:
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        q = q.filter(Emergency.created_at >= cutoff)

    total = q.count()

    severity_rows = (
        q.with_entities(Emergency.severity, func.count(Emergency.id).label("count"))
        .group_by(Emergency.severity)
        .all()
    )
    by_severity = {row.severity: row.count for row in severity_rows if row.severity is not None}

    status_rows = (
        q.with_entities(Emergency.status, func.count(Emergency.id).label("count"))
        .group_by(Emergency.status)
        .all()
    )
    by_status = {row.status.value: row.count for row in status_rows}

    type_rows = (
        q.with_entities(Emergency.emergency_type, func.count(Emergency.id).label("count"))
        .group_by(Emergency.emergency_type)
        .all()
    )
    by_type = {row.emergency_type: row.count for row in type_rows}

    active_count = q.filter(Emergency.status != EmergencyStatus.resolved).count()
    resolved_count = q.filter(Emergency.status == EmergencyStatus.resolved).count()

    IST_OFFSET = timedelta(hours=5, minutes=30)
    hourly_rows = (
        q.with_entities(
            extract("hour", Emergency.created_at).label("hour"),
            func.count(Emergency.id).label("count"),
        )
        .group_by(extract("hour", Emergency.created_at))
        .order_by(extract("hour", Emergency.created_at))
        .all()
    )
    hourly_counts = {}
    for row in hourly_rows:
        utc_hour = int(row.hour)
        ist_hour = int((utc_hour + 5.5) % 24)
        hourly_counts[ist_hour] = hourly_counts.get(ist_hour, 0) + row.count
    by_hour = [{"hour": f"{h:02d}:00", "count": hourly_counts.get(h, 0)} for h in range(24)]

    return {
        "total_emergencies": total,
        "active_count": active_count,
        "resolved_count": resolved_count,
        "by_severity": by_severity,
        "by_status": by_status,
        "by_type": by_type,
        "by_hour": by_hour,
    }


def get_emergencies_by_caller(db: Session, phone: str) -> list[Emergency]:
    return (
        db.query(Emergency)
        .filter(Emergency.caller_phone == phone)
        .order_by(Emergency.created_at.desc())
        .all()
    )


def update_emergency(db: Session, emergency_id: int, data: EmergencyUpdate) -> Emergency | None:
    record = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not record:
        return None
    update_data = data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(record, key, value)
    db.commit()
    db.refresh(record)
    return record


async def backfill_coordinates(db: Session) -> dict:
    records = db.query(Emergency).filter(
        Emergency.latitude.is_(None),
        Emergency.longitude.is_(None),
        Emergency.location.isnot(None),
    ).all()
    updated = 0; failed = 0
    for record in records:
        result = await geocode_location(record.location, record.landmark)
        if result:
            _apply_geocoding(record, result)
            updated += 1
        else:
            failed += 1
    db.commit()
    return {"total": len(records), "updated": updated, "failed": failed}


def delete_emergency(db: Session, emergency_id: int) -> bool:
    record = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True
