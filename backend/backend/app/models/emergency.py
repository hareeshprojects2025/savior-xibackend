from datetime import datetime, timezone
import enum

from sqlalchemy import Boolean, Column, Integer, String, Text, DateTime, Float, Enum as SAEnum

from app.core.database import Base


class EmergencyStatus(str, enum.Enum):
    pending = "pending"
    dispatched = "dispatched"
    en_route = "en_route"
    resolved = "resolved"


class Emergency(Base):
    __tablename__ = "emergencies"

    id = Column(Integer, primary_key=True, index=True)
    caller_name = Column(String(255), nullable=False)
    caller_phone = Column(String(20), nullable=True, default=None)
    victim_name = Column(String(255), nullable=True)
    emergency_type = Column(String(100), nullable=False)
    severity = Column(String(50), nullable=True)
    location = Column(String(500), nullable=False)
    landmark = Column(String(500), nullable=True)
    victims = Column(Integer, nullable=True)
    description = Column(Text, nullable=True)
    immediate_danger = Column(String(255), nullable=True)
    summary = Column(Text, nullable=True)
    status = Column(SAEnum(EmergencyStatus), default=EmergencyStatus.pending, nullable=False)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)
    full_transcript = Column(Text, nullable=True)
    bolna_call_id = Column(String(255), nullable=True, default=None, index=True)
    created_at = Column(DateTime, default=lambda: datetime.now(timezone.utc))

    # Phase 6 dispatch engine fields
    location_captured = Column(Boolean, default=False)
    district_check = Column(String(50), nullable=True)
    pipeline_status = Column(String(50), nullable=True, default=None)
    dispatch_record_id = Column(Integer, nullable=True)

    # Geocoding enrichment fields
    geocoded_place_name = Column(String(500), nullable=True)
    geocoded_osm_type = Column(String(10), nullable=True)
    geocoded_osm_key = Column(String(50), nullable=True)
    geocoded_city = Column(String(100), nullable=True)
    geocoded_state = Column(String(100), nullable=True)
