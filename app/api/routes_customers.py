from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db import get_session
from app.models import Call, CallAnalysis, Customer

router = APIRouter(prefix="/api/customers", tags=["customers"])


@router.get("")
def list_customers(db: Session = Depends(get_session)) -> list[dict]:
    rows = db.execute(
        select(
            Customer.id,
            Customer.name,
            func.count(Call.id),
            func.max(Call.started_at),
            func.coalesce(func.max(CallAnalysis.needs_attention_score), 0),
        )
        .join(Call, Call.customer_id == Customer.id)
        .outerjoin(CallAnalysis, CallAnalysis.call_id == Call.id)
        .group_by(Customer.id, Customer.name)
        .order_by(func.coalesce(func.max(CallAnalysis.needs_attention_score), 0).desc(), Customer.name)
    ).all()
    return [
        {"id": cid, "name": name, "call_count": n,
         "last_call_at": last.isoformat() if last else None,
         "max_attention_score": int(mx)}
        for cid, name, n, last, mx in rows
    ]


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_session)) -> dict:
    cust = db.get(Customer, customer_id)
    if not cust:
        raise HTTPException(404, "customer not found")
    calls = db.execute(
        select(Call, CallAnalysis)
        .outerjoin(CallAnalysis, CallAnalysis.call_id == Call.id)
        .where(Call.customer_id == customer_id)
        .order_by(Call.started_at.desc())
    ).all()
    return {
        "id": cust.id,
        "name": cust.name,
        "calls": [
            {
                "sid": c.id,
                "started_at": c.started_at.isoformat() if c.started_at else None,
                "agent": c.agent.name,
                "duration_s": c.duration_s,
                "resolution": a.resolution if a else None,
                "needs_attention_score": a.needs_attention_score if a else None,
                "summary": a.summary if a else None,
                "trending_issue_label": a.trending_issue_label if a else None,
            }
            for c, a in calls
        ],
    }
