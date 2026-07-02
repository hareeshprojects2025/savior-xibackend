from sqlalchemy.orm import Session

from app.models import Emergency
from app.schemas import EmergencyCreate


def create_emergency(db: Session, data: EmergencyCreate) -> Emergency:
    """Insert a new emergency record into the database."""
    record = Emergency(**data.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return record
