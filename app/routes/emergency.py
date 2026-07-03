# from fastapi import APIRouter, Depends
# from sqlalchemy.orm import Session

# from app.database import get_db
# from app.schemas import EmergencyCreate, EmergencyResponse
# from app.crud import create_emergency

# router = APIRouter(prefix="/api", tags=["Emergency"])


# @router.post("/emergency", response_model=EmergencyResponse)
# def report_emergency(data: EmergencyCreate, db: Session = Depends(get_db)):
#     """Receive emergency data from Bolna AI and store it in MySQL."""
#     try:
#         create_emergency(db, data)
#         return {"status": "success", "message": "Emergency recorded successfully."}
#     except Exception as e:
#         return {"status": "error", "message": f"Failed to record emergency: {str(e)}"}





# from fastapi import APIRouter, Depends, Request
# from sqlalchemy.orm import Session

# from app.database import get_db

# router = APIRouter(prefix="/api", tags=["Emergency"])


# @router.post("/emergency")
# async def report_emergency(
#     request: Request,
#     db: Session = Depends(get_db)
# ):
#     body = await request.json()
#     print("\n========================")
#     print("Bolna Payload:")
#     print(body)
#     print("========================\n")

#     return {
#         "status": "received"
#     }








# from fastapi import APIRouter, Request

# router = APIRouter(prefix="/api", tags=["Emergency"])


# @router.post("/emergency")
# async def report_emergency(request: Request):

#     print("\n========== HEADERS ==========")
#     print(dict(request.headers))

#     body = await request.body()

#     print("\n========== RAW BODY ==========")
#     print(body)

#     print("=============================\n")

#     return {"status": "received"}




from datetime import date
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.database import get_db
from app.schemas import EmergencyCreate, EmergencyResponse, EmergencyOut, EmergencySummary, EmergencyStats
from app.crud import (
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
)

router = APIRouter(prefix="/api", tags=["Emergency"])


@router.post("/emergency", response_model=EmergencyResponse)
def report_emergency(data: EmergencyCreate, db: Session = Depends(get_db)):
    create_emergency(db, data)
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
    db: Session = Depends(get_db),
):
    return get_recent_emergencies(db, limit=limit, offset=offset)


@router.get("/emergencies/stats", response_model=EmergencyStats)
def list_stats(db: Session = Depends(get_db)):
    return get_emergency_stats(db)


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



