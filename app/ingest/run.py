"""Ingest pipeline: metadata -> rows, audio -> transcripts.

    python -m app.ingest.run --limit 200 --workers 4
    python -m app.ingest.run --all

Idempotent: calls already transcribed are skipped unless --retranscribe.
"""
from __future__ import annotations

import argparse
import json
import tempfile
from concurrent.futures import ProcessPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from sqlalchemy import select

from app.config import AUDIO_DIR, META_DIR
from app.db import SessionLocal
from app.ingest.audio import split_channels
from app.ingest.stt import transcribe_channel
from app.models import Agent, Call, Customer, TranscriptTurn


def _dt(ms: int | None) -> datetime | None:
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc) if ms else None


def load_meta(path: Path) -> dict:
    d = json.loads(path.read_text(encoding="utf-8"))
    return {
        "sid": d["sid"],
        "agent_name": (d.get("agent", {}).get("metadata") or {}).get("agent_name") or "Unknown",
        "customer_name": (d.get("caller", {}).get("metadata") or {}).get("first and last name") or "Unknown",
        "started_at": _dt(d.get("start_time_ms")),
        "ended_at": _dt(d.get("end_time_ms")),
        "duration_s": round((d["end_time_ms"] - d["start_time_ms"]) / 1000) if d.get("end_time_ms") and d.get("start_time_ms") else None,
        "caller_mos": (d.get("labels") or {}).get("caller_mos"),
        "agent_mos": (d.get("labels") or {}).get("agent_mos"),
        "session": d.get("session"),
    }


def upsert_dimensions(metas: list[dict]) -> tuple[dict, dict]:
    """Ensure every agent/customer name has a row; return name->id maps."""
    with SessionLocal() as db:
        for name in sorted({m["agent_name"] for m in metas}):
            if not db.scalar(select(Agent).where(Agent.name == name)):
                db.add(Agent(name=name))
        existing_cust = {c.name for c in db.scalars(select(Customer)).all()}
        for name in sorted({m["customer_name"] for m in metas} - existing_cust):
            db.add(Customer(name=name))
        db.commit()
        agents = {a.name: a.id for a in db.scalars(select(Agent)).all()}
        customers = {c.name: c.id for c in db.scalars(select(Customer)).all()}
    return agents, customers


def upsert_calls(metas: list[dict], agents: dict, customers: dict) -> None:
    with SessionLocal() as db:
        have = set(db.scalars(select(Call.id)).all())
        for m in metas:
            if m["sid"] in have:
                continue
            db.add(Call(
                id=m["sid"],
                customer_id=customers[m["customer_name"]],
                agent_id=agents[m["agent_name"]],
                session=m["session"],
                started_at=m["started_at"],
                ended_at=m["ended_at"],
                duration_s=m["duration_s"],
                caller_mos=m["caller_mos"],
                agent_mos=m["agent_mos"],
            ))
        db.commit()


def _transcribe_one(sid: str) -> tuple[str, list[dict] | None, str | None]:
    """Worker-process body. Returns (sid, turns, error)."""
    try:
        mp3 = AUDIO_DIR / f"{sid}.mp3"
        with tempfile.TemporaryDirectory() as tmp:
            a_wav, c_wav = split_channels(mp3, Path(tmp))
            turns = transcribe_channel(a_wav, "agent") + transcribe_channel(c_wav, "customer")
        turns.sort(key=lambda t: (t["start_s"], 0 if t["speaker"] == "agent" else 1))
        for i, t in enumerate(turns):
            t["idx"] = i
        return sid, turns, None
    except Exception as e:  # noqa: BLE001
        return sid, None, repr(e)[:500]


def _write_turns(sid: str, turns: list[dict], error: str | None) -> None:
    with SessionLocal() as db:
        call = db.get(Call, sid)
        if call is None:
            return
        db.query(TranscriptTurn).filter(TranscriptTurn.call_id == sid).delete()
        if error is not None:
            call.transcript_status = "error"
        else:
            for t in turns:
                db.add(TranscriptTurn(
                    call_id=sid, idx=t["idx"], speaker=t["speaker"],
                    start_s=t["start_s"], end_s=t["end_s"], text=t["text"],
                ))
            call.transcript_status = "done"
        db.commit()


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=200)
    ap.add_argument("--all", action="store_true")
    ap.add_argument("--workers", type=int, default=4)
    ap.add_argument("--retranscribe", action="store_true")
    args = ap.parse_args()

    meta_files = sorted(META_DIR.glob("*.json"))
    if not args.all:
        meta_files = meta_files[: args.limit]
    metas = [load_meta(p) for p in meta_files]
    print(f"{len(metas)} calls in scope")

    agents, customers = upsert_dimensions(metas)
    upsert_calls(metas, agents, customers)
    print(f"dimensions: {len(agents)} agents, {len(customers)} customers")

    with SessionLocal() as db:
        done = set(db.scalars(select(Call.id).where(Call.transcript_status == "done")).all())
    todo = [m["sid"] for m in metas if args.retranscribe or m["sid"] not in done]
    print(f"transcribing {len(todo)} calls with {args.workers} workers "
          f"({len(done)} already done)")

    n = 0
    with ProcessPoolExecutor(max_workers=args.workers) as ex:
        for sid, turns, error in ex.map(_transcribe_one, todo):
            _write_turns(sid, turns or [], error)
            n += 1
            tag = "ERR" if error else f"{len(turns or [])} turns"
            print(f"[{n}/{len(todo)}] {sid} {tag}")
    print("ingest done")


if __name__ == "__main__":
    main()
