import logging

from sqlalchemy.orm import Session

from app.models.emergency import Emergency
from app.models.transcript import TranscriptChunk
from app.schemas.transcript import TranscriptChunkCreate

logger = logging.getLogger("savior.transcript")

_chunk_buffer: dict[str, list[dict]] = {}


def buffer_chunk(call_id: str, chunk_text: str, is_final: bool = False, speaker: str = ""):
    _chunk_buffer.setdefault(call_id, []).append({
        "chunk_text": chunk_text,
        "is_final": is_final,
        "speaker": speaker,
    })
    logger.info("Buffered chunk for call_id=%s (total=%d)", call_id, len(_chunk_buffer[call_id]))


def flush_buffer(call_id: str, emergency_id: int, db: Session) -> list[dict]:
    chunks = _chunk_buffer.pop(call_id, [])
    if not chunks:
        return []
    stored = []
    for c in chunks:
        chunk = store_chunk(db, TranscriptChunkCreate(
            emergency_id=emergency_id,
            chunk_text=c["chunk_text"],
            is_final=c["is_final"],
        ))
        stored.append({
            "chunk_text": c["chunk_text"],
            "speaker": c.get("speaker", ""),
            "is_final": c["is_final"],
        })
    logger.info("Flushed %d buffered chunks for call_id=%s -> emergency_id=%s", len(stored), call_id, emergency_id)
    return stored


def store_chunk(db: Session, data: TranscriptChunkCreate) -> TranscriptChunk:
    chunk = TranscriptChunk(
        emergency_id=data.emergency_id,
        chunk_text=data.chunk_text,
        is_final=data.is_final,
    )
    db.add(chunk)
    db.commit()
    db.refresh(chunk)
    return chunk


def get_chunks(db: Session, emergency_id: int) -> list[TranscriptChunk]:
    return (
        db.query(TranscriptChunk)
        .filter(TranscriptChunk.emergency_id == emergency_id)
        .order_by(TranscriptChunk.created_at.asc())
        .all()
    )


def complete_transcript(
    db: Session, emergency_id: int, full_text: str, summary: str | None = None
) -> Emergency | None:
    record = db.query(Emergency).filter(Emergency.id == emergency_id).first()
    if not record:
        return None
    record.full_transcript = full_text
    if summary:
        record.summary = summary
    db.commit()
    db.refresh(record)
    return record
