"""Strict JSON schema for the single per-call analysis call.

Design (from CortexV Project Pulse): the model returns typed judgments, each
bound to a `turn_idx` and a VERBATIM `quote` from that turn. Python verifies the
quote, derives timestamps, and computes every number. The model emits no scores.
"""
from __future__ import annotations

MOODS = ["positive", "neutral", "frustrated", "angry", "relieved", "anxious"]
RESOLUTIONS = ["resolved", "unresolved", "follow_up_promised", "unclear"]

_EVIDENCE = {
    "type": "object",
    "additionalProperties": False,
    "required": ["quote", "turn_idx"],
    "properties": {
        "quote": {"type": "string", "description": "VERBATIM text copied from that turn."},
        "turn_idx": {"type": "integer", "description": "idx of the turn the quote is from."},
    },
}

_NULLABLE_EVIDENCE = {
    "type": ["object", "null"],
    "additionalProperties": False,
    "required": ["quote", "turn_idx"],
    "properties": {
        "quote": {"type": "string"},
        "turn_idx": {"type": "integer"},
    },
}

_SIGNAL = {
    "type": "object",
    "additionalProperties": False,
    "required": ["present", "evidence"],
    "properties": {
        "present": {"type": "boolean"},
        "evidence": _NULLABLE_EVIDENCE,
    },
}

ANALYSIS_SCHEMA = {
    "name": "call_analysis",
    "strict": True,
    "schema": {
        "type": "object",
        "additionalProperties": False,
        "required": [
            "intent", "intent_evidence",
            "mood_timeline", "mood_shift",
            "resolution", "resolution_evidence",
            "summary", "signals", "trending_issue_label",
        ],
        "properties": {
            "intent": {"type": "string", "description": "One sentence: what the customer wanted."},
            "intent_evidence": _EVIDENCE,
            "mood_timeline": {
                "type": "array",
                "description": "The customer's mood at each point it is observable or changes. Chronological.",
                "items": {
                    "type": "object",
                    "additionalProperties": False,
                    "required": ["mood", "quote", "turn_idx"],
                    "properties": {
                        "mood": {"type": "string", "enum": MOODS},
                        "quote": {"type": "string"},
                        "turn_idx": {"type": "integer"},
                    },
                },
            },
            "mood_shift": {
                "type": ["object", "null"],
                "additionalProperties": False,
                "required": ["from_mood", "to_mood", "quote", "turn_idx"],
                "properties": {
                    "from_mood": {"type": "string", "enum": MOODS},
                    "to_mood": {"type": "string", "enum": MOODS},
                    "quote": {"type": "string"},
                    "turn_idx": {"type": "integer"},
                },
                "description": "The single most significant mood change, or null if mood never changed.",
            },
            "resolution": {"type": "string", "enum": RESOLUTIONS},
            "resolution_evidence": _EVIDENCE,
            "summary": {"type": "string", "description": "<= 40 words, plain, factual."},
            "signals": {
                "type": "object",
                "additionalProperties": False,
                "required": ["repeated_question", "explicit_dissatisfaction", "escalation_language"],
                "properties": {
                    "repeated_question": {
                        **_SIGNAL,
                        "description": "The agent had to ask the customer the same thing 3+ times, OR the customer repeated their request because it wasn't understood.",
                    },
                    "explicit_dissatisfaction": {
                        **_SIGNAL,
                        "description": "The customer explicitly voiced displeasure, complaint, or unmet expectation.",
                    },
                    "escalation_language": {
                        **_SIGNAL,
                        "description": "Customer referenced a manager, supervisor, closing the account, a complaint, legal action, or 'this is unacceptable'.",
                    },
                },
            },
            "trending_issue_label": {
                "type": "string",
                "description": "Short canonical topic, 2-4 words, reused across calls. e.g. 'lost card replacement', 'password reset', 'branch hours', 'funds transfer', 'disputed transaction'.",
            },
        },
    },
}
