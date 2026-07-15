import logging
import os
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.websocket import manager
from app.services.emergency_service import get_emergency
from app.services.dispatch_service import run_validation_pipeline

logger = logging.getLogger("savior.location.api")

router = APIRouter(tags=["Location"])

LOCATION_HTML_PATH = os.path.normpath(
    os.path.join(os.path.dirname(__file__), "..", "..", "..", "static", "location.html")
)


class LocationData(BaseModel):
    latitude: float = Field(..., ge=-90, le=90)
    longitude: float = Field(..., ge=-180, le=180)


@router.get("/location/{emergency_id}", response_class=HTMLResponse)
async def get_location_page(emergency_id: int, db: Session = Depends(get_db)):
    """Serve standalone location capture HTML page with emergency_id injected."""
    emergency = get_emergency(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    if not os.path.exists(LOCATION_HTML_PATH):
        logger.error("Location HTML template not found at %s", LOCATION_HTML_PATH)
        raise HTTPException(status_code=500, detail="Location page template not found")

    with open(LOCATION_HTML_PATH, "r") as f:
        html = f.read()

    # Template substitution
    html = html.replace("{{EMERGENCY_ID}}", str(emergency_id))
    html = html.replace("{{BASE_URL}}", "")

    return HTMLResponse(content=html)


@router.post("/location/{emergency_id}")
async def receive_location(
    emergency_id: int,
    data: LocationData,
    db: Session = Depends(get_db),
):
    """Receive captured location coordinates from browser Geolocation API.
    Auto-continues validation pipeline after location received (D-21)."""
    emergency = get_emergency(db, emergency_id)
    if not emergency:
        raise HTTPException(status_code=404, detail="Emergency not found")

    # Update emergency with captured location
    emergency.latitude = data.latitude
    emergency.longitude = data.longitude
    emergency.location_captured = True
    db.commit()
    db.refresh(emergency)

    # Broadcast location received
    await manager.broadcast({
        "type": "location_received",
        "emergency_id": emergency_id,
        "latitude": data.latitude,
        "longitude": data.longitude,
    })

    # Auto-continue validation pipeline (D-21)
    try:
        result = await run_validation_pipeline(db, emergency)
        logger.info("Validation pipeline completed for emergency %d: %s", emergency_id, result.get("status"))
    except Exception as e:
        logger.error("Validation pipeline failed for emergency %d: %s", emergency_id, e)

    return {
        "status": "success",
        "message": "Location received",
        "emergency_id": emergency_id,
    }
