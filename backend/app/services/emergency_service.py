from datetime import date, datetime, timedelta

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.emergency import Emergency
from app.schemas.emergency import EmergencyCreate, EmergencyUpdate, EmergencyStatus
from app.core.websocket import manager


def create_emergency(db: Session, data: EmergencyCreate) -> Emergency:
    record = Emergency(**data.model_dump())
    db.add(record)
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
    rows = (
        db.query(Emergency.severity, func.count(Emergency.id).label("count"))
        .group_by(Emergency.severity)
        .all()
    )
    by_severity = {row.severity: row.count for row in rows}
    return {"total_emergencies": total, "by_severity": by_severity}


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


def delete_emergency(db: Session, emergency_id: int) -> bool:
    record = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not record:
        return False
    db.delete(record)
    db.commit()
    return True
