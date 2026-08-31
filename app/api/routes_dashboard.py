from __future__ import annotations

from datetime import date, datetime, timedelta

from fastapi import APIRouter, Depends, Query
from sqlalchemy import Date, cast, func, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Agent, Call, CallAnalysis

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


def _default_day(db: Session) -> date | None:
    return db.scalar(select(func.max(cast(Call.started_at, Date))))


@router.get("/meta")
def meta(db: Session = Depends(get_session)) -> dict:
    days = db.scalars(
        select(cast(Call.started_at, Date)).distinct().order_by(cast(Call.started_at, Date))
    ).all()
    return {
        "default_date": (_default_day(db).isoformat() if _default_day(db) else None),
        "available_dates": [d.isoformat() for d in days if d],
        "total_calls": db.scalar(select(func.count(Call.id))),
        "analyzed_calls": db.scalar(select(func.count(CallAnalysis.call_id))),
    }


@router.get("/attention")
def attention(
    db: Session = Depends(get_session),
    date_: str | None = Query(None, alias="date"),
    limit: int = 25,
) -> dict:
    day = date.fromisoformat(date_) if date_ else _default_day(db)
    q = (
        select(Call, CallAnalysis, Agent.name)
        .join(CallAnalysis, CallAnalysis.call_id == Call.id)
        .join(Agent, Agent.id == Call.agent_id)
    )
    if day:
        q = q.where(cast(Call.started_at, Date) == day)
    q = q.order_by(CallAnalysis.needs_attention_score.desc()).limit(limit)

    items = []
    for call, a, agent_name in db.execute(q).all():
        reasons = [
            {"factor": t["factor"], "points": t["points"],
             "quote": (t.get("evidence") or {}).get("quote") if isinstance(t.get("evidence"), dict) else None,
             "t_seconds": (t.get("evidence") or {}).get("t_seconds") if isinstance(t.get("evidence"), dict) else None}
            for t in (a.score_breakdown or {}).get("breakdown", [])
        ]
        items.append({
            "sid": call.id,
            "customer": call.customer.name,
            "agent": agent_name,
            "started_at": call.started_at.isoformat() if call.started_at else None,
            "duration_s": call.duration_s,
            "score": a.needs_attention_score,
            "resolution": a.resolution,
            "summary": a.summary,
            "intent": a.intent,
            "issue": a.trending_issue_label,
            "reasons": reasons,
        })
    return {"date": day.isoformat() if day else None, "items": items}


@router.get("/trends")
def trends(
    db: Session = Depends(get_session),
    date_: str | None = Query(None, alias="date"),
    window: int = 7,
) -> dict:
    day = date.fromisoformat(date_) if date_ else _default_day(db)
    if not day:
        return {"date": None, "issues": []}
    cur_start = day - timedelta(days=window - 1)
    prev_start = cur_start - timedelta(days=window)

    def counts(a: date, b: date) -> dict[str, int]:
        rows = db.execute(
            select(CallAnalysis.trending_issue_label, func.count())
            .join(Call, Call.id == CallAnalysis.call_id)
            .where(cast(Call.started_at, Date) >= a, cast(Call.started_at, Date) <= b)
            .group_by(CallAnalysis.trending_issue_label)
        ).all()
        return {k or "other": v for k, v in rows}

    cur = counts(cur_start, day)
    prev = counts(prev_start, cur_start - timedelta(days=1))
    issues = sorted(
        (
            {"label": k, "count": v, "prev_count": prev.get(k, 0), "delta": v - prev.get(k, 0)}
            for k, v in cur.items()
        ),
        key=lambda x: x["count"],
        reverse=True,
    )
    return {"date": day.isoformat(), "window_days": window, "issues": issues}


@router.get("/agents")
def agents(db: Session = Depends(get_session)) -> list[dict]:
    rows = db.execute(
        select(
            Agent.name,
            func.count(Call.id),
            func.avg(Call.duration_s),
            func.avg(CallAnalysis.needs_attention_score),
            func.count(CallAnalysis.call_id).filter(CallAnalysis.resolution == "resolved"),
            func.count(CallAnalysis.call_id),
        )
        .join(Call, Call.agent_id == Agent.id)
        .outerjoin(CallAnalysis, CallAnalysis.call_id == Call.id)
        .group_by(Agent.name)
        .order_by(func.count(Call.id).desc())
    ).all()
    out = []
    for name, n, avg_dur, avg_score, resolved, analyzed in rows:
        out.append({
            "agent": name,
            "calls": n,
            "avg_handle_time_s": round(avg_dur) if avg_dur else None,
            "avg_attention_score": round(avg_score, 1) if avg_score is not None else None,
            "resolved_pct": round(100 * (resolved or 0) / analyzed) if analyzed else None,
        })
    return out
