from datetime import datetime, timezone
import enum

from sqlalchemy import Column, Integer, String, DateTime, Float, Enum as SAEnum

from app.core.database import Base


class DispatchStatus(str, enum.Enum):
    pending_call = "pending_call"
    acknowledged = "acknowledged"
    rejected = "rejected"
    no_answer = "no_answer"
    escalated = "escalated"
    dispatch_failed = "dispatch_failed"


class DispatchRecord(Base):
    __tablename__ = "dispatch_records"

    id = Column(Integer, primary_key=True, index=True)
    emergency_id = Column(Integer, nullable=False, index=True)
    station_id = Column(Integer, nullable=False)
    status = Column(SAEnum(DispatchStatus), default=DispatchStatus.pending_call, nullable=False)
    dispatched_at = Column(DateTime, nullable=True)
    acknowledged_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    def __repr__(self) -> str:
        return f"<DispatchRecord(id={self.id}, emergency_id={self.emergency_id}, status='{self.status.value}')>"
