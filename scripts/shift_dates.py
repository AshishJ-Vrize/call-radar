"""Shift every call's timestamps forward by a whole number of days so the most
recent call lands on (or near) today. Relative spacing and time-of-day are kept.

The source corpus was recorded in 2020; this makes the "needs attention today"
view meaningful for a live demo without touching transcripts or analysis.

    python -m scripts.shift_dates                # newest call -> today
    python -m scripts.shift_dates --to 2026-08-31
    python -m scripts.shift_dates --reset        # undo: restore original 2020 dates
"""
from __future__ import annotations

import argparse
from datetime import date, datetime, timedelta, timezone

from sqlalchemy import select

from app.db import SessionLocal
from app.models import Call

# original corpus anchor — the max start_time in the raw metadata
ORIGINAL_MAX = datetime(2020, 6, 2, 1, 21, 55, 190000, tzinfo=timezone.utc)


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--to", help="target date YYYY-MM-DD for the newest call (default: today)")
    ap.add_argument("--reset", action="store_true", help="restore original dates")
    args = ap.parse_args()

    with SessionLocal() as db:
        calls = db.scalars(select(Call)).all()
        if not calls:
            print("no calls")
            return
        cur_max = max(c.started_at for c in calls if c.started_at)

        if args.reset:
            shift = ORIGINAL_MAX.date() - cur_max.date()
        else:
            target = date.fromisoformat(args.to) if args.to else datetime.now(timezone.utc).date()
            shift = target - cur_max.date()

        days = timedelta(days=shift.days)
        for c in calls:
            if c.started_at:
                c.started_at = c.started_at + days
            if c.ended_at:
                c.ended_at = c.ended_at + days
        db.commit()
        new_max = max(c.started_at for c in calls if c.started_at)
        print(f"shifted {len(calls)} calls by {shift.days} days · newest call now {new_max.date()}")


if __name__ == "__main__":
    main()
