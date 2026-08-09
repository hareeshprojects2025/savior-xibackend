import logging
import os
from typing import Optional
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.websocket import manager
from app.services.emergency_service import get_emergencies_by_caller, pending_locations, normalize_phone
from app.services.dispatch_service import run_validation_pipeline

logger = logging.getLogger("savior.location.api")

router = APIRouter(tags=["Location"])

LOCATION_HTML_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "static", "location.html")
)


class LocationData(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


@router.get("/location/phone/{phone_number}", response_class=HTMLResponse)
async def get_location_page(phone_number: str, db: Session = Depends(get_db)):
    """Serve standalone location capture HTML page with phone_number injected."""
    emergencies = get_emergencies_by_caller(db, phone_number)
    if not emergencies:
        raise HTTPException(status_code=404, detail="Emergency not found")
    emergency = emergencies[0]

    if not os.path.exists(LOCATION_HTML_PATH):
        logger.error("Location HTML template not found at %s", LOCATION_HTML_PATH)
        raise HTTPException(status_code=500, detail="Location page template not found")

    with open(LOCATION_HTML_PATH, "r", encoding="utf-8") as f:
        html = f.read()

    html = html.replace("{{PHONE_NUMBER}}", str(phone_number))

    return HTMLResponse(content=html)


@router.post("/location/phone/{phone_number}")
async def receive_location(
    phone_number: str,
    data: LocationData,
    db: Session = Depends(get_db),
):
    """Receive captured location coordinates from browser Geolocation API.
    Auto-continues validation pipeline after location received (D-21)."""
    phone_key = normalize_phone(phone_number)
    
    if not phone_key:
        raise HTTPException(status_code=400, detail="Invalid phone number format")

    emergencies = get_emergencies_by_caller(db, phone_key)
    
    valid_emergency = None
    if emergencies:
        latest = emergencies[0]
        # Check if latest emergency is actually a NEW active one
        is_stale = False
        if latest.status.value == "resolved":
            is_stale = True
        elif getattr(latest, "location_captured", False) == True:
            # If it already has a location, this must be a new subsequent call!
            is_stale = True
        elif latest.created_at:
            # Check if it was created more than 2 hours ago
            now_utc = datetime.now(timezone.utc).replace(tzinfo=None)
            if now_utc - latest.created_at > timedelta(hours=2):
                is_stale = True
                
        if not is_stale:
            valid_emergency = latest

    if not valid_emergency:
        # Emergency not created yet (or old one is stale), cache it!
        pending_locations[phone_key] = data
        return {"status": "pending", "message": "Location buffered for upcoming emergency call"}
        
    emergency = valid_emergency

    # Update emergency with captured location
    emergency.latitude = data.latitude
    emergency.longitude = data.longitude
    emergency.location_captured = True
    db.commit()
    db.refresh(emergency)

    # Broadcast location received
    await manager.broadcast({
        "type": "location_received",
        "emergency_id": emergency.id,
        "latitude": data.latitude,
        "longitude": data.longitude,
    })

    # Auto-continue full pipeline (validate → rank → dispatch)
    try:
        from app.services.dispatch_service import auto_run_full_pipeline
        result = await auto_run_full_pipeline(db, emergency)
        logger.info("Auto pipeline completed for emergency %d: %s", emergency.id, result.get("status"))
    except Exception as e:
        logger.error("Auto pipeline failed for emergency %d: %s", emergency.id, e)

    return {
        "status": "success",
        "message": "Location received",
        "emergency_id": emergency.id,
    }
