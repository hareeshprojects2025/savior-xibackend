from sqlalchemy.orm import Session

from app.models.emergency import Emergency
from app.models.transcript import TranscriptChunk
from app.schemas.transcript import TranscriptChunkCreate


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
