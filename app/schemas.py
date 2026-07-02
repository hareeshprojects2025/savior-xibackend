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
