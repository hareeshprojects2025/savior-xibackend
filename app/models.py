from datetime import datetime, timezone

from sqlalchemy import Column, Integer, String, Text, DateTime, Float

from app.database import Base


class Emergency(Base):
    __tablename__ = "emergencies"

    id = Column(Integer, primary_key=True, index=True)
    caller_name = Column(String(255), nullable=False)
    caller_phone = Column(String(20), nullable=False)
    victim_name = Column(String(255), nullable=True)
    emergency_type = Column(String(100), nullable=False)
    severity = Column(String(50), nullable=True)
    location = Column(String(500), nullable=False)
    landmark = Column(String(500), nullable=True)
    victims = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    immediate_danger = Column(String(10), nullable=True)  # "Yes" / "No"
    summary = Column(Text, nullable=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))
