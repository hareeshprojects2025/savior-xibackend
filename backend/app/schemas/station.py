from typing import Optional

from pydantic import BaseModel, Field


class StationCreate(BaseModel):
    name: str = Field(..., examples=["Hubli Town Police Station"])
    type: str = Field(..., examples=["police"])
    latitude: float = Field(..., examples=[15.3452])
    longitude: float = Field(..., examples=[75.1431])
    address: str = Field(..., examples=["Durgad Bail, Broadway, Hubli, Karnataka 580028"])
    phone: Optional[str] = Field(None, examples=["0836-2233540"])


class StationOut(BaseModel):
    id: int
    name: str
    type: str
    latitude: float
    longitude: float
    address: str
    phone: Optional[str] = None

    class Config:
        from_attributes = True


class StationRankingOut(BaseModel):
    station: StationOut
    distance_km: float
    eta_minutes: float
    encoded_polyline: str
