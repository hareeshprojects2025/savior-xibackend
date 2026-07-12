import json
import logging
import time

from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.requests import ClientDisconnect
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.websocket import manager
from app.schemas.emergency import EmergencyOut
from app.schemas.transcript import TranscriptChunkCreate, TranscriptChunkOut
from app.services.transcript_service import store_chunk, get_chunks, buffer_chunk, flush_buffer
from app.services.emergency_service import get_emergency

logger = logging.getLogger("savior.transcript")
router = APIRouter(tags=["Transcript"])

_active_sessions: dict[str, dict] = {}
_session_counter = 0


def clean_stale_sessions(body: dict) -> None:
    global _active_sessions
    bolna_call_id = body.get("id")
    transcript = body.get("transcript", "")
    if transcript:
        transcript_text = str(transcript)[:200]
        stale_ids = [
            sid for sid, s in _active_sessions.items()
            if (bolna_call_id and s.get("call_id") == bolna_call_id)
            or s.get("transcript_text", "") == transcript_text
        ]
    else:
        stale_ids = [
            sid for sid, s in _active_sessions.items()
            if bolna_call_id and s.get("call_id") == bolna_call_id
        ]
    for sid in stale_ids:
        _active_sessions.pop(sid, None)
    if stale_ids:
        logger.info("Cleaned %d stale sessions", len(stale_ids))


@router.post("/transcript/chunk")
@router.post("/transcript_chunk")
async def receive_chunk(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except ClientDisconnect:
        logger.warning("Client disconnected during chunk receive")
        return {"status": "acknowledged"}
    logger.info("Bolna chunk payload: %s", json.dumps(body))

    transcript_text = body.get("transcript_text") or body.get("chunk_text") or ""
    speaker = body.get("speaker", body.get("role", ""))
    emergency_id = body.get("emergency_id")
    bolna_call_id = body.get("call_id")

    if emergency_id is not None:
        try:
            emergency_id = int(emergency_id)
        except (ValueError, TypeError):
            logger.warning("Invalid emergency_id in chunk: %s", emergency_id)
            return {"status": "acknowledged"}

        record = get_emergency(db, emergency_id)
        if not record:
            logger.warning("Emergency %s not found for chunk", emergency_id)
            return {"status": "acknowledged"}

        chunk = store_chunk(db, TranscriptChunkCreate(
            emergency_id=emergency_id,
            chunk_text=transcript_text,
            is_final=body.get("is_final", False),
        ))
        await manager.broadcast({
            "type": "transcript_chunk",
            "emergency_id": emergency_id,
            "chunk_text": transcript_text,
            "speaker": speaker,
            "is_final": body.get("is_final", False),
        })
        return chunk

    global _session_counter, _active_sessions
    prev_text = transcript_text
    prev_len = len(prev_text) if prev_text else 0

    existing = [
        k for k, v in _active_sessions.items()
        if prev_len >= len(v.get("transcript_text", ""))
        and prev_text.startswith(v.get("transcript_text", ""))
    ]

    if bolna_call_id:
        buffer_chunk(bolna_call_id, transcript_text, body.get("is_final", False), speaker)

    if existing:
        session_id = existing[0]
        _active_sessions[session_id].update({
            "transcript_text": transcript_text,
            "speaker": speaker,
            "emergency_type": body.get("emergency_type_detected", _active_sessions[session_id].get("emergency_type", "")),
            "call_id": bolna_call_id or _active_sessions[session_id].get("call_id"),
            "updated_at": time.time(),
        })
    else:
        _session_counter += 1
        session_id = f"live-{_session_counter}"
        _active_sessions[session_id] = {
            "transcript_text": transcript_text,
            "speaker": speaker,
            "emergency_type": body.get("emergency_type_detected", ""),
            "call_id": bolna_call_id or "",
            "updated_at": time.time(),
        }

    await manager.broadcast({
        "type": "live_transcript",
        "session_id": session_id,
        "transcript_text": transcript_text,
        "speaker": speaker,
        "emergency_type_detected": _active_sessions[session_id]["emergency_type"],
    })
    logger.info("Live session %s: %d chars (call_id=%s)", session_id, len(transcript_text), bolna_call_id or "none")

    if bolna_call_id:
        return {"status": "buffered", "message": f"Chunk buffered for call_id={bolna_call_id}", "session_id": session_id}
    return {"status": "live", "session_id": session_id}


@router.post("/transcript/complete")
async def receive_complete(request: Request, db: Session = Depends(get_db)):
    try:
        body = await request.json()
    except ClientDisconnect:
        logger.warning("Client disconnected during transcript/complete")
        return {"status": "acknowledged"}
    bolna_call_id = body.get("id")
    status = body.get("status")
    transcript = body.get("transcript")
    user_number = body.get("user_number")

    logger.info("Bolna webhook: call=%s status=%s has_transcript=%s full_payload=%s", bolna_call_id, status, bool(transcript), json.dumps(body)[:500])

    if status in ("completed", "call-disconnected"):
        from app.models.emergency import Emergency
        record = None

        # Strategy 1: match by bolna_call_id
        if bolna_call_id:
            record = db.query(Emergency).filter(
                Emergency.bolna_call_id == bolna_call_id
            ).first()
            if record:
                logger.info("Matched by bolna_call_id=%s → emergency id=%s", bolna_call_id, record.id)

        # Strategy 2: match by caller_phone exactly
        if not record and user_number:
            record = db.query(Emergency).filter(
                Emergency.caller_phone == user_number
            ).order_by(Emergency.created_at.desc()).first()
            if record:
                logger.info("Matched by exact phone=%s → emergency id=%s", user_number, record.id)

        # Strategy 3: match by last 10 digits of phone
        if not record and user_number and len(user_number) >= 10:
            suffix = user_number[-10:]
            record = db.query(Emergency).filter(
                Emergency.caller_phone.like(f"%{suffix}")
            ).order_by(Emergency.created_at.desc()).first()
            if record:
                logger.info("Matched by 10-digit suffix=%s → emergency id=%s", suffix, record.id)

        # Strategy 4: most recent emergency without full_transcript
        if not record:
            record = db.query(Emergency).filter(
                Emergency.full_transcript.is_(None)
            ).order_by(Emergency.created_at.desc()).first()
            if record:
                logger.info("Matched by no-transcript fallback → emergency id=%s", record.id)

        if not record and transcript:
            logger.warning("No emergency found to attach transcript (call=%s, user_number=%s)", bolna_call_id, user_number)
            return {"status": "acknowledged", "message": "No emergency matched"}

        if record and not transcript:
            logger.info("Webhook received without transcript text (call=%s, emergency=%s) — acknowledging only", bolna_call_id, record.id)
            if bolna_call_id and not record.bolna_call_id:
                record.bolna_call_id = bolna_call_id
                db.commit()
            await manager.broadcast({
                "type": "transcript_complete",
                "emergency_id": record.id,
            })
            clean_stale_sessions(body)
            return {"status": "acknowledged", "message": "No transcript in webhook"}

        if record and transcript:
            transcript_text = str(transcript)
            summary_text = None
            extracted = body.get("extracted_data") or {}
            general = extracted.get("General") or {}
            call_summary = general.get("Call Summary") or {}
            if call_summary.get("subjective"):
                summary_text = call_summary["subjective"]

            if bolna_call_id and not record.bolna_call_id:
                record.bolna_call_id = bolna_call_id
            record.full_transcript = transcript_text
            if summary_text:
                if not record.summary:
                    record.summary = summary_text
                if not record.description:
                    record.description = summary_text
            db.commit()
            db.refresh(record)

            lines = [l.strip() for l in transcript_text.split("\n") if l.strip()]
            for line in lines:
                chunk = store_chunk(db, TranscriptChunkCreate(
                    emergency_id=record.id,
                    chunk_text=line,
                    is_final=True,
                ))
                await manager.broadcast({
                    "type": "transcript_chunk",
                    "emergency_id": record.id,
                    "chunk_text": line,
                    "speaker": "AI" if line.startswith(("AI:", "Agent:")) else "Caller",
                    "is_final": True,
                })

            if bolna_call_id:
                buffered = flush_buffer(bolna_call_id, record.id, db)
                if buffered:
                    for chunk in buffered:
                        await manager.broadcast({
                            "type": "transcript_chunk",
                            "emergency_id": record.id,
                            "chunk_text": chunk["chunk_text"],
                            "speaker": chunk["speaker"],
                            "is_final": chunk["is_final"],
                        })

            clean_stale_sessions(body)

            await manager.broadcast({
                "type": "transcript_complete",
                "emergency_id": record.id,
            })
            await manager.broadcast({
                "type": "transcript_resolved",
                "emergency_id": record.id,
                "full_transcript": transcript_text,
                "summary": summary_text or "",
            })
            await manager.broadcast({
                "type": "new_emergency",
                "data": EmergencyOut.model_validate(record).model_dump(),
            })
            return {"status": "success", "message": "Transcript saved successfully.", "emergency_id": record.id}

    # Acknowledge all webhooks to stop Bolna retries
    return {"status": "acknowledged", "message": f"Webhook received for call {bolna_call_id} status={status}"}


@router.get("/transcript/live-sessions")
async def get_live_sessions():
    sessions = [
        {
            "session_id": sid,
            "transcript_text": s["transcript_text"],
            "speaker": s.get("speaker", ""),
            "emergency_type": s.get("emergency_type", ""),
            "call_id": s.get("call_id", ""),
            "updated_at": s.get("updated_at", 0),
        }
        for sid, s in _active_sessions.items()
    ]
    return {"sessions": sessions}


@router.get("/transcript/{emergency_id}/chunks", response_model=list[TranscriptChunkOut])
def list_chunks(emergency_id: int, db: Session = Depends(get_db)):
    record = get_emergency(db, emergency_id)
    if not record:
        raise HTTPException(status_code=404, detail="Emergency not found")
    return get_chunks(db, emergency_id)
