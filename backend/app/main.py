import logging
from contextlib import asynccontextmanager

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
)
logging.getLogger("uvicorn.access").setLevel(logging.INFO)

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text

from app.core.database import engine, Base
from app.core.websocket import manager
from app.api.v1.endpoints.emergency import router as emergency_router
from app.api.v1.endpoints.transcript import router as transcript_router
from app.api.v1.endpoints.dispatch import router as dispatch_router
from app.api.v1.endpoints.location import router as location_router

logger = logging.getLogger("savior.main")

Base.metadata.create_all(bind=engine)


def _ensure_columns(table: str, columns: dict[str, str]) -> None:
    """Add missing columns to an existing table (create_all won't alter them)."""
    try:
        inspector = inspect(engine)
        existing = {c["name"] for c in inspector.get_columns(table)}
        missing = [c for c in columns if c not in existing]
        if not missing:
            return
        with engine.begin() as conn:
            for col in missing:
                conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {col} {columns[col]}"))
        logger.info("Added %s columns: %s", table, ", ".join(missing))
    except Exception as e:
        logger.warning("Could not ensure %s columns: %s", table, e)


_ensure_columns("dispatch_records", {
    "ack_deadline": "DATETIME NULL",
    "call_status": "VARCHAR(50) NULL",
    "bolna_execution_id": "VARCHAR(255) NULL",
})
_ensure_columns("emergencies", {
    "inbound_call_active": "TINYINT(1) NOT NULL DEFAULT 0",
    "call_wait_deadline": "DATETIME NULL",
})


@asynccontextmanager
async def lifespan(app: FastAPI):
    from app.services.dispatch_service import start_escalation_sweep

    sweep = start_escalation_sweep()
    yield
    sweep.cancel()


app = FastAPI(title="SAVIOR Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(emergency_router, prefix="/api")
app.include_router(transcript_router, prefix="/api")
app.include_router(dispatch_router, prefix="/api")
app.include_router(location_router, prefix="/api")


@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            data = await websocket.receive_text()
            if data and data.strip():
                import json
                try:
                    msg = json.loads(data)
                    if msg.get("type") == "ping":
                        await websocket.send_json({"type": "pong"})
                except json.JSONDecodeError:
                    pass
    except WebSocketDisconnect:
        manager.disconnect(websocket)