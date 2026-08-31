"""Quote verification + deterministic needs-attention score.

The model proposes evidence; this module is the judge. Only verified evidence
counts toward the score, and the score is a fixed rubric — no model number.
"""
from __future__ import annotations

import re

_WS = re.compile(r"\s+")


def _norm(s: str) -> str:
    s = s.lower().replace("’", "'")
    s = re.sub(r"[^a-z0-9' ]+", " ", s)
    return _WS.sub(" ", s).strip()


def verify_quote(quote: str | None, turn_idx: int | None, turns_by_idx: dict[int, str]) -> bool:
    if not quote or turn_idx is None or turn_idx not in turns_by_idx:
        return False
    q = _norm(quote)
    if len(q) < 3:
        return False
    hay = _norm(turns_by_idx[turn_idx])
    if q in hay:
        return True
    # tolerate minor ASR drift: most quote tokens present in the cited turn
    qt = q.split()
    hit = sum(1 for w in qt if w in hay)
    return hit / len(qt) >= 0.7


def t_seconds(turn_idx: int | None, turn_starts: dict[int, float]) -> float | None:
    return turn_starts.get(turn_idx) if turn_idx is not None else None


def clean_analysis(raw: dict, turns: list[dict]) -> dict:
    """Return a DB-ready analysis dict: unverifiable evidence stripped, timestamps filled."""
    by_text = {t["idx"]: t["text"] for t in turns}
    by_start = {t["idx"]: float(t["start_s"]) for t in turns}

    def ev(e: dict | None) -> dict | None:
        if not e or not verify_quote(e.get("quote"), e.get("turn_idx"), by_text):
            return None
        return {"quote": e["quote"], "turn_idx": e["turn_idx"], "t_seconds": by_start.get(e["turn_idx"])}

    intent_ev = ev(raw.get("intent_evidence"))
    res_ev = ev(raw.get("resolution_evidence"))

    timeline = []
    for m in raw.get("mood_timeline") or []:
        e = ev({"quote": m.get("quote"), "turn_idx": m.get("turn_idx")})
        if e:
            timeline.append({"mood": m["mood"], **e})

    shift = raw.get("mood_shift")
    if shift:
        e = ev({"quote": shift.get("quote"), "turn_idx": shift.get("turn_idx")})
        shift = {"from_mood": shift["from_mood"], "to_mood": shift["to_mood"], **e} if e else None

    def sig(name: str) -> dict:
        raw_s = (raw.get("signals") or {}).get(name) or {}
        e = ev(raw_s.get("evidence")) if raw_s.get("present") else None
        return {"present": bool(e), "evidence": e}

    signals = {k: sig(k) for k in ("repeated_question", "explicit_dissatisfaction", "escalation_language")}

    return {
        "intent": raw.get("intent") if intent_ev else (raw.get("intent")),
        "intent_evidence": intent_ev,
        "mood_timeline": timeline,
        "mood_shift": shift,
        "resolution": raw.get("resolution") if res_ev else "unclear",
        "resolution_evidence": res_ev,
        "summary": _cap_words(raw.get("summary") or "", 40),
        "signals": signals,
        "trending_issue_label": canon_issue(raw.get("trending_issue_label")),
    }


def _cap_words(s: str, n: int) -> str:
    w = s.split()
    return s if len(w) <= n else " ".join(w[:n]).rstrip(",.;:") + "…"


_ISSUE_CANON = [
    ("card", "replace"), ("card", "lost"), ("card", "stolen"),
]
_ISSUE_MAP = {
    "lost card": "lost/replacement card", "lost credit card": "lost/replacement card",
    "card replacement": "lost/replacement card", "replacement card": "lost/replacement card",
    "lost card replacement": "lost/replacement card", "credit card replacement": "lost/replacement card",
    "account balance": "balance enquiry", "balance enquiry": "balance enquiry",
    "balance inquiry": "balance enquiry", "check balance": "balance enquiry",
    "savings balance check": "balance enquiry", "account balance inquiry": "balance enquiry",
    "funds transfer": "funds transfer", "money transfer": "funds transfer",
    "transfer funds": "funds transfer", "account transfer": "funds transfer",
    "password reset": "password reset", "reset password": "password reset",
    "branch hours": "branch hours / location", "branch location": "branch hours / location",
    "appointment scheduling": "appointment booking", "schedule appointment": "appointment booking",
    "book appointment": "appointment booking", "appointment booking": "appointment booking",
    "disputed transaction": "disputed transaction", "transaction dispute": "disputed transaction",
    "fraud": "fraud / dispute", "fraudulent charge": "fraud / dispute",
}


def canon_issue(label: str) -> str:
    s = (label or "other").strip().lower()
    if s in _ISSUE_MAP:
        return _ISSUE_MAP[s]
    for a, b in _ISSUE_CANON:
        if a in s and b in s:
            return "lost/replacement card"
    return s[:80]


NEGATIVE_END_MOODS = {"frustrated": 10, "angry": 20, "anxious": 6}


def compute_score(clean: dict, *, duration_s: int | None, caller_mos: float | None,
                  duration_p90: float) -> dict:
    """0-100 from verified signals + computed facts. Returns {score, breakdown:[...] }."""
    terms: list[dict] = []

    res = clean["resolution"]
    if res == "unresolved":
        terms.append({"factor": "unresolved", "points": 35,
                      "evidence": clean["resolution_evidence"]})
    elif res == "follow_up_promised":
        terms.append({"factor": "follow_up_promised", "points": 12,
                      "evidence": clean["resolution_evidence"]})

    s = clean["signals"]
    if s["explicit_dissatisfaction"]["present"]:
        terms.append({"factor": "explicit_dissatisfaction", "points": 25,
                      "evidence": s["explicit_dissatisfaction"]["evidence"]})
    if s["escalation_language"]["present"]:
        terms.append({"factor": "escalation_language", "points": 20,
                      "evidence": s["escalation_language"]["evidence"]})
    if s["repeated_question"]["present"]:
        terms.append({"factor": "repeated_question", "points": 15,
                      "evidence": s["repeated_question"]["evidence"]})

    if clean["mood_timeline"]:
        end_mood = clean["mood_timeline"][-1]["mood"]
        if end_mood in NEGATIVE_END_MOODS:
            terms.append({"factor": f"ends_{end_mood}", "points": NEGATIVE_END_MOODS[end_mood],
                          "evidence": clean["mood_timeline"][-1]})

    sh = clean["mood_shift"]
    if sh and sh["to_mood"] in ("frustrated", "angry") and sh["from_mood"] in ("positive", "neutral", "relieved"):
        terms.append({"factor": "negative_mood_shift", "points": 10, "evidence": sh})

    if duration_s and duration_p90 and duration_s >= duration_p90:
        terms.append({"factor": "long_call", "points": 10,
                      "evidence": {"note": f"{duration_s}s ≥ p90 {round(duration_p90)}s"}})

    if caller_mos is not None and float(caller_mos) <= 2:
        terms.append({"factor": "poor_audio_quality", "points": 5,
                      "evidence": {"note": f"caller_mos={caller_mos}"}})

    score = max(0, min(100, sum(t["points"] for t in terms)))
    return {"score": score, "breakdown": terms}
