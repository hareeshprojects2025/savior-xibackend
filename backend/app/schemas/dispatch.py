from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class DispatchStatus(str, Enum):
    pending_call = "pending_call"
    acknowledged = "acknowledged"
    rejected = "rejected"
    no_answer = "no_answer"
    escalated = "escalated"
    dispatch_failed = "dispatch_failed"


class DispatchRequest(BaseModel):
    emergency_id: int
    station_id: int


class DispatchResponse(BaseModel):
    status: str
    dispatch_id: int
    message: str


class DispatchRecordOut(BaseModel):
    id: int
    emergency_id: int
    station_id: int
    status: DispatchStatus
    dispatched_at: Optional[datetime] = None
    acknowledged_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
