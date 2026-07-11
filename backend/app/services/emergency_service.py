import asyncio
from datetime import date, datetime, timedelta

from sqlalchemy import extract, func
from sqlalchemy.orm import Session

from app.models.emergency import Emergency
from app.schemas.emergency import EmergencyCreate, EmergencyUpdate, EmergencyStatus
from app.core.websocket import manager
from app.services.geocoding_service import geocode_location


def create_emergency(db: Session, data: EmergencyCreate) -> Emergency:
    record = Emergency(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    if record.latitude is None and record.longitude is None and record.location:
        coords = asyncio.run(geocode_location(record.location))
        if coords:
            record.latitude, record.longitude = coords
            db.commit()
            db.refresh(record)
    return record


def get_emergencies(db: Session) -> list[Emergency]:
    return db.query(Emergency).order_by(Emergency.created_at.desc()).all()


def get_emergency(db: Session, emergency_id: int) -> Emergency | None:
    return db.query(Emergency).filter(Emergency.id == emergency_id).first()


def get_recent_emergencies(db: Session, limit: int = 10, offset: int = 0) -> list[Emergency]:
    return (
        db.query(Emergency)
        .order_by(Emergency.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )


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


def get_emergency_stats(db: Session) -> dict:
    total = db.query(Emergency).count()

    severity_rows = (
        db.query(Emergency.severity, func.count(Emergency.id).label("count"))
        .group_by(Emergency.severity)
        .all()
    )
    by_severity = {row.severity: row.count for row in severity_rows}

    status_rows = (
        db.query(Emergency.status, func.count(Emergency.id).label("count"))
        .group_by(Emergency.status)
        .all()
    )
    by_status = {row.status.value: row.count for row in status_rows}

    type_rows = (
        db.query(Emergency.emergency_type, func.count(Emergency.id).label("count"))
        .group_by(Emergency.emergency_type)
        .all()
    )
    by_type = {row.emergency_type: row.count for row in type_rows}

    active_count = db.query(Emergency).filter(Emergency.status != EmergencyStatus.resolved).count()
    resolved_count = db.query(Emergency).filter(Emergency.status == EmergencyStatus.resolved).count()

    hourly_rows = (
        db.query(
            extract("hour", Emergency.created_at).label("hour"),
            func.count(Emergency.id).label("count"),
        )
        .group_by(extract("hour", Emergency.created_at))
        .order_by(extract("hour", Emergency.created_at))
        .all()
    )
    hourly_counts = {int(row.hour): row.count for row in hourly_rows}
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


def backfill_coordinates(db: Session) -> dict:
    records = db.query(Emergency).filter(
        Emergency.latitude.is_(None),
        Emergency.longitude.is_(None),
        Emergency.location.isnot(None),
    ).all()
    updated = 0; failed = 0
    for record in records:
        coords = asyncio.run(geocode_location(record.location))
        if coords:
            record.latitude, record.longitude = coords
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
