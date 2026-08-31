# Call‑Centre Radar

A conversation‑intelligence system over raw support‑call recordings. It ingests
the recordings exactly as they come off the phone system, turns them into
speaker‑attributed transcripts with timings, and builds an evidence‑cited
analysis layer behind an API and an admin dashboard.

> **Every judgment cites the moment that justifies it** — a timestamp and the
> words spoken there. The language model only *extracts* typed evidence (verbatim
> quotes bound to a transcript turn); Python verifies each quote against the
> transcript and computes every number. Evidence that can't be found is dropped,
> and the judgment it supported falls back to “unclear”.

---

## What the task asked for, and where it lives

| Requirement (from the brief) | Implementation |
|---|---|
| Speech → text, *who said what*, turn by turn with timings | `app/ingest/` — ffmpeg splits the stereo call (L=agent, R=customer), `faster‑whisper` transcribes each channel locally; speaker is the channel, so no diarization is needed. Stored in `transcript_turns`. |
| Per customer: every customer by name, full call history, recording + transcript per call | `GET /api/customers`, `GET /api/customers/{id}`, `GET /api/calls/{sid}` (+ `/audio`). Dashboard: **Customers** → customer file. |
| Per call: intent, mood **and the point it shifted**, resolved?, summary ≤ 40 words | `app/analyze/` — one structured `gpt‑5‑mini` call per call. Fields: `intent`, `mood_timeline`, `mood_shift`, `resolution`, `summary` (word‑capped). Dashboard: **Call file**. |
| Across all calls: which need a manager’s attention **today**, ranked | `GET /api/dashboard/attention?date=` — `needs_attention_score` 0–100 from a deterministic rubric. Dashboard: **Watch List**. |
| Across all calls: which issues are trending | `GET /api/dashboard/trends` — canonicalised `trending_issue_label`, count + change vs the prior window. |
| Across all calls: per‑agent volumes, handle times, outcomes | `GET /api/dashboard/agents`. Dashboard: **Agents**. |
| Every judgment cites a timestamp + the words spoken | Every analysis field carries `{quote, turn_idx, t_seconds}`; quotes are character‑checked against the cited turn (`app/analyze/score.py::verify_quote`). |
| Don’t re‑transcribe on every request | Transcripts and analysis are computed once and stored in Postgres; the API only reads. |
| Run the whole thing from scratch, including transcription | [Run it from scratch](#run-it-from-scratch) below. |

---

## Architecture

```
            INGEST  (run once per call, cached)                ANALYSE  (one LLM call per call, cached)
 ┌─────────────────────────────────────────────┐   ┌──────────────────────────────────────────────────────┐
 callradar-data/                                    transcript_turns
  ├─ audio/<id>.mp3   ─ ffmpeg channelsplit ─▶  ┐        │
  │   8 kHz stereo                              │   gpt-5-mini · strict JSON schema · 1 request / call
  │   L = agent, R = customer          agent.wav / customer.wav        │
  │                                            │   intent · mood_timeline · mood_shift · resolution
  │                              faster-whisper base.en (local,        · summary(≤40w) · signals · issue label
  │                              CPU, int8, VAD) — 1 pass per channel   each bound to  {quote, turn_idx}
  │                                            │                        │
  └─ metadata/<id>.json ─▶ customer / agent /  │   quote verification (char-match vs transcript)
     timestamps / MOS labels                   │                +  deterministic score rubric
                    │                          ▼                        ▼
              agents, customers, calls   transcript_turns        call_analysis  (score 0–100 + breakdown)
 └───────────────────────────────┬───────────────────────────────────────┬──────────────────────────────┘
                                 ▼                                       ▼
                       ┌──────────────────────  Postgres  ──────────────────────┐
                       │  agents · customers · calls · transcript_turns · call_analysis   │
                       └──────────────────────────────┬─────────────────────────┘
                                                      ▼
                          FastAPI   (app/api/) — reads cached rows only, never re-transcribes
                          /api/calls/{sid} · /api/calls/{sid}/audio
                          /api/customers · /api/customers/{id}
                          /api/dashboard/{attention, trends, agents, meta}
                                                      ▼
                          React + Vite dashboard   (web/)
                          Watch List · Customers → Customer file · Call file
                          (custom waveform · conversation field · energy graph · transcript · intelligence rail)
```

**Stack:** Python 3.11 · FastAPI · SQLAlchemy + Alembic · PostgreSQL · `faster‑whisper`
(local STT, no transcription API) · Azure OpenAI `gpt‑5‑mini` (analysis) · React 18 + Vite + Tailwind.

---

## The pipeline in detail

### 1 · Recordings → transcript (`python -m app.ingest.run`)

1. Read every `metadata/<id>.json`; upsert `agents`, `customers`, and a `calls`
   row (start/end from the epoch‑ms timestamps, duration, `caller_mos`/`agent_mos`).
2. For each call, `ffmpeg` splits the stereo MP3 into two mono 16 kHz WAVs —
   **left → agent, right → customer**.
3. `faster‑whisper` (`base.en`, int8, VAD filter) transcribes each channel
   separately. Because the channels are already separated, the speaker label is
   just the channel — **no diarization, and no cross‑talk confusion**.
4. Both channels’ segments are merged, sorted by start time, and written to
   `transcript_turns (idx, speaker, start_s, end_s, text)`.
   `calls.transcript_status → done`.

Runs across a process pool. Idempotent: finished calls are skipped unless
`--retranscribe`. `--limit N` for a subset, `--all` for the full 1,441.

### 2 · Transcript → intelligence (`python -m app.analyze.run`)

1. The transcript is rendered as a numbered, speaker‑tagged, `@mm:ss` turn list.
2. **One `gpt‑5‑mini` request per call**, constrained by a strict JSON schema
   (`app/analyze/schema.py`) — closed enums only, the model emits **no numbers**.
   It returns: `intent`, `mood_timeline` (customer mood at each observable
   point), `mood_shift` (the single biggest change, or null), `resolution`
   (`resolved` / `follow_up_promised` / `unresolved` / `unclear`), `summary`,
   three escalation `signals`, and a `trending_issue_label` — **each with a
   verbatim `quote` and the `turn_idx` it came from**.
3. **Verification** (`app/analyze/score.py`): every quote is normalised and
   character‑matched against its cited turn. Anything that doesn’t match is
   discarded; a field with no surviving evidence degrades gracefully
   (`resolution → unclear`, `mood_shift → null`, `signal → absent`).
4. **Deterministic scoring** — the needs‑attention score is a fixed rubric over
   *verified* signals only, plus two computed facts:

   | Signal | Points |
   |---|--:|
   | Resolution `unresolved` | +35 |
   | Resolution `follow_up_promised` | +12 |
   | Customer voiced explicit dissatisfaction | +25 |
   | Escalation language (manager / complaint / close account / legal) | +20 |
   | Agent had to repeat a question / customer had to repeat themselves | +15 |
   | Call ends `angry` +20 · `frustrated` +10 · `anxious` +6 | |
   | Negative mood shift that never recovers | +10 |
   | Handle time in the top decile *(computed)* | +10 |
   | `caller_mos ≤ 2` — poor line *(computed)* | +5 |

   Clamped to 0–100. `score_breakdown` keeps every term with its quote, and the
   dashboard shows the whole derivation.

Idempotent (`--reanalyze` to force). `calls.analysis_status → done`.

### 3 · (optional) `python -m scripts.shift_dates`

The supplied corpus was recorded in 2020. This shifts every call’s timestamps
forward by a whole number of days so the newest call lands on **today** —
making the “needs attention **today**” view meaningful for a live demo. It only
rewrites `calls.started_at/ended_at`; `--reset` restores the originals.

---

## Run it from scratch

**Prerequisites:** Python 3.11 · Node 20+ · `ffmpeg` on `PATH` · a PostgreSQL
database · an Azure OpenAI `gpt‑5‑mini` deployment · the dataset unzipped to
`../callradar-data/` (so `callradar-data/audio/` and `callradar-data/metadata/`
sit next to this repo).

```bash
cd call-radar

# 1 · Python environment
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt          # Windows
# source .venv/bin/activate && pip install -r requirements.txt   # macOS / Linux

# 2 · Configuration
cp .env.example .env
#   set DATABASE_URL, AZURE_OPENAI_ENDPOINT, AZURE_OPENAI_API_KEY, GPT_DEPLOYMENT

# 3 · Database schema (Alembic)
.venv/Scripts/python -m alembic upgrade head

# 4 · Turn recordings into transcripts, then into analysis
#     --limit N for a demo subset · --all for the full 1,441 calls
.venv/Scripts/python -m app.ingest.run  --limit 250 --workers 4
.venv/Scripts/python -m app.analyze.run --limit 250 --workers 6

# 5 · (optional) make the corpus land on "today" for the demo
.venv/Scripts/python -m scripts.shift_dates

# 6 · API   →  http://localhost:8077/docs
.venv/Scripts/python -m uvicorn app.api.main:app --port 8077

# 7 · Dashboard   →  http://localhost:5173   (proxies /api to :8077)
cd web && npm install && npm run dev
```

Or chain steps 3–5 with `LIMIT=250 bash scripts/seed.sh`.

Transcription is CPU‑bound (~5–8 s per call with `base.en`). Set
`WHISPER_MODEL=small.en` in `.env` for higher accuracy at roughly double the time.

---

## API

Base URL `http://localhost:8077`. Interactive docs at `/docs`.

| Method & path | Returns |
|---|---|
| `GET /api/calls/{sid}` | The full per‑call contract — see sample below. |
| `GET /api/calls/{sid}/audio` | Streams the original MP3 (`audio/mpeg`). |
| `GET /api/customers` | Every customer: call count, last call, peak attention score. |
| `GET /api/customers/{id}` | One customer + their full call history. |
| `GET /api/dashboard/attention?date=&limit=` | Calls needing a manager’s attention on `date` (default: latest day in the data), ranked by score, each with its reason breakdown. |
| `GET /api/dashboard/trends?date=&window=7` | Trending issue labels: count in the window and change vs the prior window. |
| `GET /api/dashboard/agents` | Per agent: call volume, average handle time, resolved %, average attention score. |
| `GET /api/dashboard/meta` | Available dates and totals (drives the date picker). |

<details>
<summary><code>GET /api/calls/{sid}</code> — sample response</summary>

```jsonc
{
  "sid": "0a37e848a9c04e0c",
  "customer": { "id": 26, "name": "James Brown" },
  "agent": "Elizabeth",
  "started_at": "2026-08-30T23:48:08+00:00",
  "duration_s": 71,
  "caller_mos": 5.0, "agent_mos": 5.0,
  "transcript": [
    { "idx": 0, "speaker": "customer", "start_s": 0.0,  "end_s": 22.29,
      "text": "Hello, my name is James, but I would like to schedule an appointment." },
    { "idx": 1, "speaker": "agent",    "start_s": 1.71, "end_s": 5.71,
      "text": "Hello, this is Harper Valley National Bank." }
    // … one object per turn
  ],
  "analysis": {
    "intent": "The customer wanted to schedule an appointment.",
    "intent_evidence": { "quote": "…schedule an appointment.", "turn_idx": 0, "t_seconds": 0.0 },
    "mood_timeline": [
      { "mood": "neutral",  "quote": "…schedule an appointment.", "turn_idx": 0,  "t_seconds": 0.0 },
      { "mood": "positive", "quote": "Thank you very much.",       "turn_idx": 12, "t_seconds": 63.66 }
    ],
    "mood_shift": { "from_mood": "neutral", "to_mood": "positive",
                    "quote": "Thank you very much.", "turn_idx": 12, "t_seconds": 63.66 },
    "resolution": "unresolved",
    "resolution_evidence": { "quote": "Is there anything else I can help you with?", "turn_idx": 9, "t_seconds": 53.64 },
    "summary": "Customer wanted to schedule an appointment (3:45 PM); agent asked to repeat and moved on. No confirmation was made, call ended without scheduling.",
    "needs_attention_score": 50,
    "score_breakdown": { "score": 50, "breakdown": [
      { "factor": "unresolved",        "points": 35, "evidence": { "quote": "Is there anything else I can help you with?", "turn_idx": 9, "t_seconds": 53.64 } },
      { "factor": "repeated_question", "points": 15, "evidence": { "quote": "345 PM, 345 PM.", "turn_idx": 7, "t_seconds": 41.54 } }
    ] },
    "trending_issue_label": "appointment booking",
    "model": "gpt-5-mini"
  }
}
```
</details>

---

## Data model

Single Alembic migration, `alembic/versions/0001_initial.py`.

| Table | Purpose |
|---|---|
| `agents`, `customers` | Dimensions, keyed by name from the metadata. |
| `calls` | One row per recording (`sid`), FK to agent/customer, timestamps, MOS, `transcript_status`, `analysis_status`. |
| `transcript_turns` | The produced transcript — `(call_id, idx, speaker, start_s, end_s, text)`, unique on `(call_id, idx)`. |
| `call_analysis` | One row per call — intent, mood timeline, mood shift, resolution, summary, `needs_attention_score`, `score_breakdown`, issue label. Evidence objects live in JSONB. |

Trends and per‑agent rollups are `GROUP BY` queries over these tables — no
derived/materialised tables. `alembic downgrade base` drops everything.

---

## Dashboard (`web/`)

| Screen | What it shows |
|---|---|
| **Watch List** (`/attention`) | Calls needing a manager’s attention on a chosen day, ranked; each with score, summary, and reason tags. Trending‑issues rail alongside. |
| **Agents** (`/agents`) | Sortable table of volume, handle time, resolved %, average attention. |
| **Customers** (`/customers`) | Searchable directory → **Customer file** (`/customers/{id}`): full call history. |
| **Call file** (`/calls/{sid}`) | Playable recording via a custom waveform; a *conversation field* placing flagged moments on the call’s timeline; a *conversation‑energy* mood curve; the editorial transcript; and an *intelligence rail* — intent, summary, outcome, signals, and the score breakdown, every line linking back to its timestamp. |

The waveform is decoded in the browser, so the whole instrument (field, waveform,
energy graph, transcript) shares one time axis and one playhead.

---

## Project layout

```
call-radar/
├─ app/
│  ├─ config.py  db.py  models.py
│  ├─ ingest/    run.py · audio.py (ffmpeg split) · stt.py (faster-whisper)
│  ├─ analyze/   run.py · prompts.py · schema.py · score.py · llm.py
│  └─ api/       main.py · routes_calls.py · routes_customers.py · routes_dashboard.py
├─ alembic/versions/0001_initial.py
├─ scripts/      seed.sh · shift_dates.py
├─ web/          Vite + React dashboard
└─ requirements.txt  ·  .env.example
```

---

## Design notes

- **Local transcription, by design.** No transcription API — `faster‑whisper`
  runs on CPU. The stereo split removes the hardest part (diarization) for free.
- **The model never scores.** It labels closed categories and quotes lines;
  Python counts and scores. Scores stay comparable across calls and every number
  is explainable.
- **Corpus.** The provided calls are a scripted test set recorded in 2020 and
  cluster on a few recording days; `scripts/shift_dates.py` brings them to the
  present for the demo.
- **Out of scope:** auth, multi‑tenancy, Docker, RAG/vector search, word‑level
  alignment, and transcribing the full 1,441 during a live demo (a subset is
  loaded; `--all` is provided).

Transcription approach is adapted from **ContextIQ**’s local STT service;
the evidence‑first extraction schema and prompt discipline from **CortexV
Project Pulse**.
