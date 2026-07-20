import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.models.emergency import Emergency
from app.schemas.emergency import EmergencyCreate

logger = logging.getLogger("savior.duplicate")


def check_duplicate(
    db: Session,
    location: str,
    emergency_type: str,
    created_at: datetime,
    exclude_id: int | None = None,
) -> Emergency | None:
    """Check for duplicate emergencies: same location string + same type + within 1-hour window.
    Returns the first matching Emergency record or None."""
    window_start = created_at - timedelta(hours=1)
    q = db.query(Emergency).filter(
        func.lower(Emergency.location) == location.lower(),
        func.lower(Emergency.emergency_type) == emergency_type.lower(),
        Emergency.created_at >= window_start,
        Emergency.created_at < created_at,
    )
    if exclude_id is not None:
        q = q.filter(Emergency.id != exclude_id)
    match = q.order_by(Emergency.created_at.desc()).first()
    if match:
        logger.info(
            "Duplicate found: emergency %d matches location='%s', type='%s', within 1h window",
            match.id, location, emergency_type,
        )
    return match


def merge_duplicate(db: Session, existing: Emergency, new_data: EmergencyCreate) -> Emergency:
    """Merge a duplicate emergency by appending new description and caller info to existing record."""
    # Append description
    if new_data.description and new_data.description.strip():
        separator = "\n---\n"
        existing.description = (existing.description or "") + separator + new_data.description

    # Append caller info
    new_caller_info_parts = []
    if new_data.caller_name:
        new_caller_info_parts.append(new_data.caller_name)
    if new_data.caller_phone:
        new_caller_info_parts.append(f"({new_data.caller_phone})")
    if new_caller_info_parts:
        caller_note = ", " + " ".join(new_caller_info_parts)
        if existing.description:
            existing.description += caller_note
        else:
            existing.description = caller_note.strip(", ")

    db.commit()
    db.refresh(existing)
    logger.info("Merged duplicate: emergency %d updated with new data", existing.id)
    return existing


def is_duplicate(
    db: Session,
    location: str,
    emergency_type: str,
    created_at: Optional[datetime] = None,
    exclude_id: Optional[int] = None,
) -> tuple[bool, Emergency | None]:
    """Combined check: returns (is_duplicate, existing_record) for use in dispatch pipeline."""
    if created_at is None:
        created_at = datetime.now(timezone.utc)
    match = check_duplicate(db, location, emergency_type, created_at, exclude_id=exclude_id)
    return (match is not None, match)
