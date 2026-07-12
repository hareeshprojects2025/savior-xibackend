from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class EmergencyStatus(str, Enum):
    pending = "pending"
    dispatched = "dispatched"
    en_route = "en_route"
    resolved = "resolved"


class EmergencyCreate(BaseModel):
    caller_name: str = Field(..., examples=["Alice"])
    caller_phone: str = Field(..., examples=["+919876543210"])
    victim_name: Optional[str] = Field(None, examples=["Bob"])
    emergency_type: str = Field(..., examples=["Fire"])
    severity: Optional[str] = Field(None, examples=["High"])
    location: str = Field(..., examples=["123 Main Street, Mumbai"])
    landmark: Optional[str] = Field(None, examples=["Near City Hospital"])
    victims: Optional[int] = Field(None, examples=[3])
    description: Optional[str] = Field(None, examples=["Smoke coming from third floor"])
    immediate_danger: Optional[str] = Field(None, examples=["Yes"])
    summary: Optional[str] = Field(None, examples=["Fire at 123 Main Street. 3 victims."])
    latitude: Optional[float] = Field(None, examples=[15.3647])
    longitude: Optional[float] = Field(None, examples=[75.1240])
    status: Optional[EmergencyStatus] = None
    created_at: Optional[datetime] = None


class EmergencyUpdate(BaseModel):
    status: EmergencyStatus
    summary: Optional[str] = None
    full_transcript: Optional[str] = None


class EmergencyResponse(BaseModel):
    status: str
    message: str


class EmergencyOut(BaseModel):
    id: int
    caller_name: str
    caller_phone: Optional[str] = None
    victim_name: Optional[str] = None
    emergency_type: str
    severity: Optional[str] = None
    location: str
    landmark: Optional[str] = None
    victims: Optional[int] = None
    description: Optional[str] = None
    immediate_danger: Optional[str] = None
    summary: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: EmergencyStatus
    full_transcript: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EmergencySummary(BaseModel):
    id: int
    caller_name: str
    caller_phone: Optional[str] = None
    emergency_type: str
    severity: Optional[str] = None
    location: str
    description: Optional[str] = None
    victims: Optional[int] = None
    immediate_danger: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    status: EmergencyStatus
    created_at: datetime

    class Config:
        from_attributes = True


class EmergencyStats(BaseModel):
    total_emergencies: int
    active_count: int
    resolved_count: int
    by_severity: dict[str, int]
    by_status: dict[str, int]
    by_type: dict[str, int]
    by_hour: list[dict[str, int | str]]
