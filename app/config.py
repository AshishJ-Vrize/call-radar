"""Runtime configuration. Reads hack-p1/.env (one level up) — secrets live only there."""
from __future__ import annotations

import os
from functools import lru_cache
from pathlib import Path

from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parents[1]        # .../hack-p1/call-radar
DATA_DIR = REPO_ROOT.parent / "callradar-data"          # .../hack-p1/callradar-data
AUDIO_DIR = DATA_DIR / "audio"
META_DIR = DATA_DIR / "metadata"

# Load ../.env first (shared hackathon env), then a local .env if present.
load_dotenv(REPO_ROOT.parent / ".env")
load_dotenv(REPO_ROOT / ".env", override=True)


def _clean(v: str | None) -> str:
    return (v or "").strip()


class Settings:
    def __init__(self) -> None:
        raw_db = _clean(os.getenv("DATABASE_URL"))
        # SQLAlchemy needs an explicit driver; the .env uses the bare scheme.
        if raw_db.startswith("postgresql://"):
            raw_db = raw_db.replace("postgresql://", "postgresql+psycopg://", 1)
        self.DATABASE_URL = raw_db

        endpoint = _clean(os.getenv("AZURE_OPENAI_ENDPOINT"))
        # .env carries an OpenAI-v1 style suffix; the AzureOpenAI SDK wants the bare resource URL.
        endpoint = endpoint.split("/openai")[0].rstrip("/")
        self.AZURE_OPENAI_ENDPOINT = endpoint
        self.AZURE_OPENAI_API_KEY = _clean(os.getenv("AZURE_OPENAI_API_KEY"))
        # Verified working for gpt-5-mini (needs a preview version that accepts reasoning params).
        self.AZURE_OPENAI_API_VERSION = _clean(os.getenv("AZURE_OPENAI_API_VERSION_OVERRIDE")) or "2025-04-01-preview"
        self.GPT_DEPLOYMENT = _clean(os.getenv("GPT_DEPLOYMENT")) or "gpt-5-mini"

        self.WHISPER_MODEL = _clean(os.getenv("WHISPER_MODEL")) or "base.en"
        self.PROMPT_VERSION = 1


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()
