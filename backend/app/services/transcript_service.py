import logging
import re

from sqlalchemy.orm import Session

from app.models.emergency import Emergency
from app.models.transcript import TranscriptChunk
from app.schemas.transcript import TranscriptChunkCreate

logger = logging.getLogger("savior.transcript")

_chunk_buffer: dict[str, list[dict]] = {}

_NUMBER_WORDS = {
    "one": 1, "two": 2, "three": 3, "four": 4, "five": 5,
    "six": 6, "seven": 7, "eight": 8, "nine": 9, "ten": 10,
}

_DANGER_KEYWORDS = [
    "fire", "petrol", "leakage", "gas", "smoke", "flood", "bleeding",
    "trapped", "collapsed", "unconscious", "electrical", "water logging",
]

_CRITICAL_KEYWORDS = [
    "critical", "unconscious", "not breathing", "severe bleeding",
    "broken bone", "serious", "heart attack",
]

_HIGH_KEYWORDS = ["bleeding", "broken", "fracture", "severe pain", "head injury", "heavy bleeding"]

_LOW_KEYWORDS = ["mild", "minor", "small", "not serious", "okay", "fine"]


def extract_emergency_intel(transcript: str) -> dict:
    """Rule-based fallback: extract structured intel from a raw transcript.

    Used when Bolna's extracted_data is absent or empty. Only scans CALLER
    lines (user:/caller:) for factual intel — assistant questions like
    "is there fire nearby?" must never become data. Returns found fields."""
    result: dict = {}
    text = str(transcript or "")
    low = text.lower()

    # Caller lines only — the caller's actual statements
    caller_lines = []
    for ln in text.splitlines():
        stripped = ln.strip()
        if stripped.lower().startswith(("user:", "caller:", "victim:")):
            caller_lines.append(stripped.split(":", 1)[1].strip())
    user_text = "\n".join(caller_lines)
    user_low = user_text.lower()
    full_low = low

    # Caller name — "my name is Samruddh" / "this is Samruddh" / "i am Samruddh"
    m = re.search(r"my name is ([A-Za-z][A-Za-z .'-]{1,40})", user_text, re.IGNORECASE)
    if not m:
        m = re.search(r"this is ([A-Za-z][A-Za-z .'-]{1,40})", user_text, re.IGNORECASE)
    if not m:
        m = re.search(r"i am ([A-Za-z][A-Za-z .'-]{1,40})", user_text, re.IGNORECASE)
    if m:
        name = m.group(1).strip().strip(" .,;!?")
        if name.lower() not in {"sir", "madam", "fine", "good", "okay"} and len(name) > 1:
            result["caller_name"] = name

    # Victims count — "I am the only person injured" → 1; "two people injured" → 2
    if re.search(r"(only person|only one|only me|i am the only)", user_low):
        result["victims"] = 1
    else:
        m = re.search(
            r"(\d+|one|two|three|four|five|six|seven|eight|nine|ten)\s+"
            r"(?:people|persons|person|injured|victims|trapped|kids|children)",
            user_low,
        )
        if m:
            num_str = m.group(1).lower()
            result["victims"] = int(num_str) if num_str.isdigit() else _NUMBER_WORDS[num_str]

    # Landmark — "landmark is B.B. College" (tolerating fillers like "landmark is, uh, X"),
    # then "near X" / "next to X" / "opposite X" / "in front of X"
    m = re.search(
        r"landmark\s*is\s*[:,.\-]?\s*(?:uh\s*[:,.\-]?\s*)?"
        r"([A-Za-z0-9][A-Za-z0-9 .'&#-]{1,60})",
        user_text,
        re.IGNORECASE,
    )
    if not m:
        m = re.search(
            r"(?:near|next to|beside|opposite|in front of)\s+"
            r"([A-Za-z0-9][A-Za-z0-9 .'&#-]{1,60})",
            user_text,
            re.IGNORECASE,
        )
    if m:
        landmark = m.group(1).strip().strip(" .,;!?")
        if len(landmark) >= 3:
            result["landmark"] = landmark

    # Immediate danger — keyword scan of CALLER lines only
    dangers = [d for d in _DANGER_KEYWORDS if d in user_low]
    if dangers:
        result["immediate_danger"] = ", ".join(sorted(set(dangers)))

    # Severity — caller lines only (assistant prompts contain suggestive words)
    if any(k in user_low for k in _CRITICAL_KEYWORDS):
        result["severity"] = "Critical"
    elif any(k in user_low for k in _HIGH_KEYWORDS):
        result["severity"] = "High"
    elif any(k in user_low for k in _LOW_KEYWORDS):
        result["severity"] = "Low"
    elif re.search(r"pain|injur|hurt", user_low):
        result["severity"] = "Medium"

    # Spoken summary — last assistant turn containing "to summarize"
    lines = [ln.strip() for ln in text.splitlines() if ln.strip()]
    for ln in reversed(lines):
        if ln.lower().startswith(("assistant:", "agent:", "ai:")):
            body = ln.split(":", 1)[1].strip() if ":" in ln else ln
            m = re.search(r"to summarize\s*:?\s*(.+)", body, re.IGNORECASE)
            if m:
                result["summary"] = m.group(1).strip()
            break

    if result:
        logger.info("Transcript intel extraction found: %s", sorted(result.keys()))
    return result


def apply_transcript_intel(record: Emergency, intel: dict) -> bool:
    """Fill empty fields on an emergency from extracted intel.
    victims is only overwritten when current value is None or 0 (false zero)."""
    changed = False
    if "caller_name" in intel and (not record.caller_name or record.caller_name == "Unknown"):
        record.caller_name = intel["caller_name"]
        changed = True
    if "victims" in intel and (record.victims is None or record.victims == 0):
        record.victims = intel["victims"]
        changed = True
    if "landmark" in intel and not record.landmark:
        record.landmark = intel["landmark"]
        changed = True
    if "immediate_danger" in intel and not record.immediate_danger:
        record.immediate_danger = intel["immediate_danger"]
        changed = True
    if "severity" in intel and not record.severity:
        record.severity = intel["severity"]
        changed = True
    if "summary" in intel and not record.summary:
        record.summary = intel["summary"]
        changed = True
    if "summary" in intel and not record.description:
        record.description = intel["summary"]
        changed = True
    return changed


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
