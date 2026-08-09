from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.websocket import manager
from app.schemas.emergency import (
    EmergencyCreate,
    EmergencyUpdate,
    EmergencyResponse,
    EmergencyOut,
    EmergencySummary,
    EmergencyStats,
)
from app.services.emergency_service import (
    create_emergency,
    get_emergencies,
    get_emergency,
    get_recent_emergencies,
    get_emergencies_by_severity,
    get_emergencies_by_type,
    get_emergencies_by_location,
    get_emergencies_by_date,
    get_mass_casualty_emergencies,
    get_emergency_stats,
    get_emergencies_by_caller,
    update_emergency,
    delete_emergency,
    backfill_coordinates,
)

router = APIRouter(tags=["Emergency"])


@router.post("/emergencies/geocode")
async def geocode_existing(db: Session = Depends(get_db)):
    result = await backfill_coordinates(db)
    return result


@router.post("/emergency", response_model=EmergencyResponse)
async def report_emergency(data: EmergencyCreate, db: Session = Depends(get_db)):
    record = await create_emergency(db, data, background_geocode=True)
    await manager.broadcast({
        "type": "new_emergency",
        "data": EmergencyOut.model_validate(record).model_dump(),
    })
    return {
        "status": "success",
        "message": "Emergency recorded successfully."
    }


@router.get("/emergencies", response_model=List[EmergencyOut])
def list_emergencies(db: Session = Depends(get_db)):
    return get_emergencies(db)


@router.get("/emergencies/recent", response_model=List[EmergencySummary])
def list_recent_emergencies(
    limit: int = Query(10, ge=1, le=100),
    offset: int = Query(0, ge=0),
    in_coverage: bool = Query(False, description="Filter to only in-coverage-area emergencies"),
    db: Session = Depends(get_db),
):
    return get_recent_emergencies(db, limit=limit, offset=offset, in_coverage=in_coverage)


@router.get("/emergencies/stats", response_model=EmergencyStats)
def list_stats(
    days: Optional[int] = Query(None, ge=1, description="Only include emergencies from the last N days"),
    today: bool = Query(False, description="Filter to current calendar date (IST)"),
    db: Session = Depends(get_db),
):
    return get_emergency_stats(db, days=days, today=today)


@router.get("/emergencies/type/{emergency_type}", response_model=List[EmergencySummary])
def list_by_type(emergency_type: str, db: Session = Depends(get_db)):
    return get_emergencies_by_type(db, emergency_type)


@router.get("/emergencies/severity/{severity}", response_model=List[EmergencySummary])
def list_by_severity(severity: str, db: Session = Depends(get_db)):
    return get_emergencies_by_severity(db, severity)


@router.get("/emergencies/location/{location}", response_model=List[EmergencySummary])
def list_by_location(location: str, db: Session = Depends(get_db)):
    return get_emergencies_by_location(db, location)


@router.get("/emergencies/date/{emergency_date}", response_model=List[EmergencySummary])
def list_by_date(emergency_date: date, db: Session = Depends(get_db)):
    return get_emergencies_by_date(db, emergency_date)


@router.get("/emergencies/mass-casualty", response_model=List[EmergencySummary])
def list_mass_casualty(
    min_victims: int = Query(10, ge=1),
    db: Session = Depends(get_db),
):
    return get_mass_casualty_emergencies(db, min_victims)


@router.get("/emergencies/caller/{phone}", response_model=List[EmergencySummary])
def list_by_caller(phone: str, db: Session = Depends(get_db)):
    return get_emergencies_by_caller(db, phone)


@router.get("/emergencies/{emergency_id}", response_model=EmergencyOut)
def get_emergency_by_id(emergency_id: int, db: Session = Depends(get_db)):
    record = get_emergency(db, emergency_id)
    if not record:
        raise HTTPException(status_code=404, detail="Emergency not found")
    return record


@router.patch("/emergencies/{emergency_id}/status", response_model=EmergencyOut)
async def update_emergency_status(
    emergency_id: int,
    data: EmergencyUpdate,
    db: Session = Depends(get_db),
):
    record = update_emergency(db, emergency_id, data)
    if not record:
        raise HTTPException(status_code=404, detail="Emergency not found")
    await manager.broadcast({"type": "status_update", "emergency_id": emergency_id, "status": record.status.value})
    return record


@router.delete("/emergencies/{emergency_id}", response_model=EmergencyResponse)
async def remove_emergency(emergency_id: int, db: Session = Depends(get_db)):
    if not delete_emergency(db, emergency_id):
        raise HTTPException(status_code=404, detail="Emergency not found")
    await manager.broadcast({
        "type": "emergency_deleted",
        "emergency_id": emergency_id,
    })
    return {
        "status": "success",
        "message": "Emergency deleted successfully."
    }
