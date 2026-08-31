"""Analysis pipeline: transcript -> one gpt-5-mini call -> verified analysis -> DB.

    python -m app.analyze.run --limit 200 --workers 6
    python -m app.analyze.run --all --reanalyze

Idempotent: calls with analysis_status='done' are skipped unless --reanalyze.
"""
from __future__ import annotations

import argparse
from concurrent.futures import ThreadPoolExecutor

from sqlalchemy import select

from app.analyze.llm import complete_json
from app.analyze.prompts import SYSTEM_PROMPT, build_input
from app.analyze.schema import ANALYSIS_SCHEMA
from app.analyze.score import clean_analysis, compute_score
from app.config import get_settings
from app.db import SessionLocal
from app.models import Call, CallAnalysis, TranscriptTurn


def _duration_p90() -> float:
    with SessionLocal() as db:
        vals = sorted(v for v in db.scalars(select(Call.duration_s)).all() if v)
    if not vals:
        return 1e9
    return vals[min(len(vals) - 1, int(len(vals) * 0.9))]


def analyze_call(sid: str, duration_p90: float) -> str:
    s = get_settings()
    with SessionLocal() as db:
        call = db.get(Call, sid)
        turns = [
            {"idx": t.idx, "speaker": t.speaker, "start_s": float(t.start_s), "text": t.text}
            for t in db.scalars(
                select(TranscriptTurn).where(TranscriptTurn.call_id == sid).order_by(TranscriptTurn.idx)
            )
        ]
        cust, agent = call.customer.name, call.agent.name
        duration_s, caller_mos = call.duration_s, call.caller_mos

    if not turns:
        return "skip-empty"

    raw = complete_json(
        SYSTEM_PROMPT,
        build_input(customer_name=cust, agent_name=agent, turns=turns),
        ANALYSIS_SCHEMA,
    )
    clean = clean_analysis(raw, turns)
    scored = compute_score(
        clean, duration_s=duration_s,
        caller_mos=float(caller_mos) if caller_mos is not None else None,
        duration_p90=duration_p90,
    )

    with SessionLocal() as db:
        db.query(CallAnalysis).filter(CallAnalysis.call_id == sid).delete()
        db.add(CallAnalysis(
            call_id=sid,
            intent=clean["intent"],
            intent_evidence=clean["intent_evidence"],
            mood_timeline=clean["mood_timeline"],
            mood_shift=clean["mood_shift"],
            resolution=clean["resolution"],
            resolution_evidence=clean["resolution_evidence"],
            summary=clean["summary"],
            needs_attention_score=scored["score"],
            score_breakdown=scored,
            trending_issue_label=clean["trending_issue_label"],
            model=s.GPT_DEPLOYMENT,
            prompt_version=s.PROMPT_VERSION,
        ))
        db.get(Call, sid).analysis_status = "done"
        db.commit()
    return f"score={scored['score']} {clean['resolution']}"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--workers", type=int, default=6)
    ap.add_argument("--reanalyze", action="store_true")
    args = ap.parse_args()

    with SessionLocal() as db:
        q = select(Call.id).where(Call.transcript_status == "done").order_by(Call.id)
        if not args.reanalyze:
            q = q.where(Call.analysis_status != "done")
        sids = list(db.scalars(q).all())
    if not args.all:
        sids = sids[: args.limit]

    p90 = _duration_p90()
    print(f"analyzing {len(sids)} calls, {args.workers} workers, duration p90={p90}s")

    n = 0
    with ThreadPoolExecutor(max_workers=args.workers) as ex:
        futs = {ex.submit(analyze_call, sid, p90): sid for sid in sids}
        for fut in futs:
            sid = futs[fut]
            n += 1
            try:
                print(f"[{n}/{len(sids)}] {sid} {fut.result()}")
            except Exception as e:  # noqa: BLE001
                print(f"[{n}/{len(sids)}] {sid} ERROR {e!r}")
                with SessionLocal() as db:
                    db.get(Call, sid).analysis_status = "error"
                    db.commit()
    print("analysis done")


if __name__ == "__main__":
    main()
