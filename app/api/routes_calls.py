from __future__ import annotations

from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import AUDIO_DIR
from app.db import get_session
from app.models import Call, CallAnalysis, TranscriptTurn

router = APIRouter(prefix="/api/calls", tags=["calls"])


@router.get("/{sid}")
def get_call(sid: str, db: Session = Depends(get_session)) -> dict:
    call = db.get(Call, sid)
    if not call:
        raise HTTPException(404, "call not found")
    turns = db.scalars(
        select(TranscriptTurn).where(TranscriptTurn.call_id == sid).order_by(TranscriptTurn.idx)
    ).all()
    a: CallAnalysis | None = call.analysis
    return {
        "sid": call.id,
        "customer": {"id": call.customer_id, "name": call.customer.name},
        "agent": call.agent.name,
        "session": call.session,
        "started_at": call.started_at.isoformat() if call.started_at else None,
        "duration_s": call.duration_s,
        "caller_mos": float(call.caller_mos) if call.caller_mos is not None else None,
        "agent_mos": float(call.agent_mos) if call.agent_mos is not None else None,
        "transcript_status": call.transcript_status,
        "analysis_status": call.analysis_status,
        "transcript": [
            {"idx": t.idx, "speaker": t.speaker, "start_s": float(t.start_s),
             "end_s": float(t.end_s), "text": t.text}
            for t in turns
        ],
        "analysis": None if not a else {
            "intent": a.intent,
            "intent_evidence": a.intent_evidence,
            "mood_timeline": a.mood_timeline,
            "mood_shift": a.mood_shift,
            "resolution": a.resolution,
            "resolution_evidence": a.resolution_evidence,
            "summary": a.summary,
            "needs_attention_score": a.needs_attention_score,
            "score_breakdown": a.score_breakdown,
            "trending_issue_label": a.trending_issue_label,
            "model": a.model,
        },
    }


@router.get("/{sid}/audio")
def get_audio(sid: str) -> FileResponse:
    path = AUDIO_DIR / f"{sid}.mp3"
    if not path.exists():
        raise HTTPException(404, "audio not found")
    return FileResponse(Path(path), media_type="audio/mpeg", filename=f"{sid}.mp3")
