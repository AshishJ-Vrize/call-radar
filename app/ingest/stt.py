"""Local speech-to-text with faster-whisper (CPU, int8). No API calls.

Inspired by ContextIQ's stt_service, stripped to the one path we need: a small
English Whisper model per channel, VAD-filtered, greedy decode. Because the two
speakers are already separated onto their own audio channels we skip diarization
entirely — the speaker label is whichever channel the segment came from.
"""
from __future__ import annotations

import os
from pathlib import Path

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")

_MODEL = None


def get_model():
    global _MODEL
    if _MODEL is None:
        from faster_whisper import WhisperModel

        name = os.getenv("WHISPER_MODEL", "base.en")
        _MODEL = WhisperModel(name, device="cpu", compute_type="int8")
    return _MODEL


def transcribe_channel(wav_path: Path, speaker: str) -> list[dict]:
    model = get_model()
    segments, _info = model.transcribe(
        str(wav_path),
        language="en",
        vad_filter=True,
        vad_parameters={"min_silence_duration_ms": 500},
        beam_size=1,
        condition_on_previous_text=False,
    )
    out = []
    for s in segments:
        text = s.text.strip()
        if not text:
            continue
        out.append({
            "speaker": speaker,
            "start_s": round(s.start, 2),
            "end_s": round(s.end, 2),
            "text": text,
        })
    return out
