from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class TranscriptChunkCreate(BaseModel):
    emergency_id: int = Field(..., examples=[1])
    chunk_text: str = Field(..., examples=["Caller reports smoke coming from..."])
    is_final: bool = Field(False, examples=[False])


class TranscriptComplete(BaseModel):
    emergency_id: int = Field(..., examples=[1])
    full_transcript: str = Field(..., examples=["Complete transcript of the emergency call..."])
    summary: Optional[str] = None


class TranscriptChunkOut(BaseModel):
    id: int
    emergency_id: int
    chunk_text: str
    is_final: bool
    created_at: datetime

    class Config:
        from_attributes = True
