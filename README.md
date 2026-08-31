# 📡 Call-Centre Radar

Conversation intelligence over raw support-call recordings. Turns 1,441 stereo
phone recordings into searchable, evidence-cited insight: per-customer call
history, per-call intent / mood / resolution / summary, and a ranked
"needs a manager's attention today" board with trending issues and per-agent stats.

**Every AI judgment cites a timestamp and the words spoken there.** The LLM only
extracts typed evidence with verbatim quotes; Python verifies each quote against
the transcript and computes every score. Unverifiable evidence is dropped.

## How it works

```
callradar-data/audio/<id>.mp3   ─ ffmpeg channelsplit ─▶  agent.wav + customer.wav
        (stereo: L=agent, R=customer)                          │
                                                    faster-whisper base.en (local, CPU, int8)
                                                               │  no diarization — speaker = channel
                                              transcript_turns (idx, speaker, start_s, text)
                                                               │
                                              1 × gpt-5-mini structured call per call
                                     intent · mood_timeline · mood_shift · resolution ·
                                     summary(≤40w) · escalation signals · issue label
                                                               │  quote verification + rubric
                                              call_analysis (score 0-100 + breakdown, all in Postgres)
                                                               │
                                        FastAPI  ◀── reads cached rows only ──▶  React dashboard
```

- **Local transcription only** — `faster-whisper` (Whisper `base.en`), no transcription API. Inspired by ContextIQ's STT service, minus diarization: the two speakers are already on separate audio channels.
- **Evidence-first analysis** — schema + prompt design taken from CortexV "Project Pulse": closed enums, verbatim quotes bound to `turn_idx`, model emits no numbers.
- **Deterministic scoring** — `app/analyze/score.py` is a fixed rubric over *verified* signals (unresolved +35, explicit dissatisfaction +25, escalation language +20, repeated question +15, ends frustrated/angry, negative mood shift, long call, poor audio). Full term-by-term breakdown with quotes is stored and shown in the UI.

## Run it from scratch

Prereqs: **Python 3.11**, **Node 20+**, **ffmpeg** on PATH, a **Postgres** database, an **Azure OpenAI** `gpt-5-mini` deployment.

```bash
cd call-radar

# 1. Python env
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt      # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS/Linux

# 2. Config — copy and fill in
cp .env.example .env        # DATABASE_URL, AZURE_OPENAI_*, GPT_DEPLOYMENT

# 3. Schema (Alembic migration)
.venv/Scripts/python -m alembic upgrade head

# 4. Transcribe + analyse.  --limit N for a subset, --all for the full 1,441.
.venv/Scripts/python -m app.ingest.run  --limit 250 --workers 4
.venv/Scripts/python -m app.analyze.run --limit 250 --workers 6
#   ( or: LIMIT=250 bash scripts/seed.sh )

# 5. API  (http://localhost:8077/docs)
.venv/Scripts/python -m uvicorn app.api.main:app --port 8077

# 6. Dashboard  (http://localhost:5173)
cd web && npm install && npm run dev
```

Both `ingest` and `analyze` are **idempotent** — re-running skips finished calls
(`--retranscribe` / `--reanalyze` to force). Transcription is CPU-bound (~5–8 s
per call with `base.en`); `WHISPER_MODEL=small.en` is more accurate and slower.

## API

| Route | Purpose |
|---|---|
| `GET /api/calls/{sid}` | full contract: transcript (speaker + timings), intent, mood_timeline, mood_shift, resolution, summary, needs_attention_score, score_breakdown — every field with its quote + `t_seconds` |
| `GET /api/calls/{sid}/audio` | streams the recording |
| `GET /api/customers` · `/api/customers/{id}` | customer list / one customer's call history |
| `GET /api/dashboard/attention?date=&limit=` | ranked "needs a manager's attention", with reason chips |
| `GET /api/dashboard/trends?date=&window=7` | issue label → count + week-over-week delta |
| `GET /api/dashboard/agents` | per agent: volume, avg handle time, resolved %, avg attention |
| `GET /api/dashboard/meta` | available dates, totals (drives the date picker) |

"Today" defaults to the most recent call date in the loaded data (the corpus is from 2020); override with `?date=YYYY-MM-DD`.

## Schema (`alembic/versions/0001_initial.py`)

`agents`, `customers`, `calls`, `transcript_turns`, `call_analysis` (evidence in
JSONB). Trends and agent rollups are `GROUP BY` queries — no derived tables.
Drop everything with `alembic downgrade base`.

## Deliberately out of scope

Auth, multi-tenant, Docker, RAG/embeddings, word-level alignment. Transcription
of the full corpus during a demo — a subset is loaded; `--all` is provided and
documented.
