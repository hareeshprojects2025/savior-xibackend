import json
import logging

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

    if bolna_call_id:
        buffer_chunk(bolna_call_id, transcript_text, body.get("is_final", False), speaker)
        return {"status": "buffered", "message": f"Chunk buffered for call_id={bolna_call_id}"}

    logger.warning("Chunk received without emergency_id or call_id")
    return {"status": "acknowledged"}


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

    logger.info("Bolna webhook: call=%s status=%s has_transcript=%s", bolna_call_id, status, bool(transcript))

    # If this is a completed call with transcript, try to find by caller_phone
    if status in ("completed", "call-disconnected") and transcript and user_number:
        from app.models.emergency import Emergency
        record = db.query(Emergency).filter(
            Emergency.caller_phone == user_number
        ).order_by(Emergency.created_at.desc()).first()

        if record:
            transcript_text = str(transcript)
            summary_text = None
            extracted = body.get("extracted_data") or {}
            general = extracted.get("General") or {}
            call_summary = general.get("Call Summary") or {}
            if call_summary.get("subjective"):
                summary_text = call_summary["subjective"]

            logger.info("Matched emergency id=%s via caller_phone=%s", record.id, user_number)
            record.full_transcript = transcript_text
            if summary_text:
                if not record.summary:
                    record.summary = summary_text
                if not record.description:
                    record.description = summary_text
            db.commit()
            db.refresh(record)

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

            await manager.broadcast({
                "type": "transcript_complete",
                "emergency_id": record.id,
            })
            await manager.broadcast({
                "type": "new_emergency",
                "data": EmergencyOut.model_validate(record).model_dump(),
            })
            return {"status": "success", "message": "Transcript saved successfully.", "emergency_id": record.id}
        else:
            logger.warning("No emergency found for caller_phone=%s", user_number)

    # Acknowledge all webhooks to stop Bolna retries
    return {"status": "acknowledged", "message": f"Webhook received for call {bolna_call_id} status={status}"}


@router.get("/transcript/{emergency_id}/chunks", response_model=list[TranscriptChunkOut])
def list_chunks(emergency_id: int, db: Session = Depends(get_db)):
    record = get_emergency(db, emergency_id)
    if not record:
        raise HTTPException(status_code=404, detail="Emergency not found")
    return get_chunks(db, emergency_id)
