from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


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
    victims: Optional[int] = None
    created_at: datetime

    class Config:
        from_attributes = True


class EmergencyStats(BaseModel):
    total_emergencies: int
    by_severity: dict[str, int]
