# Call-Centre Radar — Implementation Plan

_Hackathon build. Target: working API + dashboard in ~2 hours. Reuse code from ContextIQ (local STT) and CortexV Project Pulse (evidence-first LLM analysis)._

## 0. What we verified before planning

| Check | Result |
|---|---|
| Data | 1,441 calls. `audio/<sid>.mp3` (stereo, 8 kHz, ~45 s avg, **L=agent / R=customer**), `metadata/<sid>.json` (customer name, agent name, ms timestamps, `caller_mos`/`agent_mos`, session). 100 customers, 10 agents. |
| Content | Real support scripts — e.g. _"I lost my credit card, send me a new one"_ → agent orders replacement, _"3–5 business days"_, resolved. Bank = "Harper Valley National Bank". |
| Local STT | `faster-whisper base.en`, int8, CPU. Channel-split with ffmpeg → transcribe each channel separately → **speaker is known, no diarization needed**. ~5–8 s per call. |
| DB | Azure Postgres `call_radar` reachable (PG 16). |
| LLM | Azure OpenAI `gpt-5-mini` reachable (`api_version=2025-04-01-preview`). |

## 1. Architecture (one line)

**Transcribe once → analyse once → store in Postgres → API reads cached rows → dashboard.**
Nothing is re-transcribed or re-analysed on request. Every LLM judgment carries a verbatim quote + timestamp or it is dropped (CortexV rule: _the model extracts evidence, Python does the scoring_).

```
callradar-data/            ingest/                     analyze/                 api/ + web/
  audio/<sid>.mp3   ─┐   1. load metadata            4. one gpt-5-mini call    FastAPI  ── Next.js
  metadata/<sid>.json│   2. ffmpeg channelsplit         per call → typed JSON   /calls      dashboard
                     └─▶ 3. faster-whisper x2       5. Python computes         /customers
                         → transcript_turns            needs-attention score   /dashboard
```

## 2. Pipeline detail

### 2a. Ingest (`ingest/run.py`)
1. Scan `metadata/*.json`; upsert `agents`, `customers`, `calls` (map `sid`, names, `start_time_ms`/`end_time_ms` → timestamps, duration, `caller_mos`, `agent_mos`, `session`).
2. For each call: `ffmpeg -i mp3 -filter_complex channelsplit → agent.wav, customer.wav` (16 kHz mono, to a temp dir).
3. `faster-whisper base.en` (int8, CPU, `vad_filter=True`, `beam_size=1`) on each channel. Model loaded **once** per worker.
4. Merge both channels' segments, sort by `start`, write `transcript_turns` (`idx`, `speaker` = `agent`|`customer`, `start_s`, `end_s`, `text`). Set `calls.transcript_status='done'`.
5. `--limit N` (demo subset, default 200), `--all`, `--workers K` (default 4, `ProcessPoolExecutor`), `--reanalyze`. Idempotent: skip calls already `done`.

### 2b. Analyse (`analyze/run.py`)
One structured `gpt-5-mini` call per call. Input = numbered turn list with `@mm:ss` + speaker (CortexV `build_batch_input` style). **JSON schema, strict mode** (`additionalProperties:false`, every field required, enums closed) — adapted from CortexV `extraction/schemas.py`.

Model returns, each with `quote` (verbatim, character-checked against the turn) + `turn_idx` + `t_seconds`:
- `intent` — one sentence: what the customer wanted + evidence.
- `mood_timeline` — list of `{t_seconds, mood ∈ {positive,neutral,frustrated,angry,relieved}, quote}` sampled at each mood change.
- `mood_shift` — `{from, to, t_seconds, quote}` or null (the single biggest shift).
- `resolution` — enum `{resolved, unresolved, follow_up_promised, unclear}` + evidence.
- `summary` — ≤ 40 words (enforced in Python; re-ask once if over).
- `attention_signals` — booleans/enums the score is built from: `repeated_question` (agent asked same thing ≥3×), `unresolved`, `escalation_language`, `explicit_dissatisfaction`, `long_call` (computed in Python from duration percentile), each with a quote when true.
- `trending_issue_label` — short canonical label ("lost card replacement", "disputed transaction", "card not working") for cross-call trend counting.

**Quote verification** (CortexV): normalise whitespace/case, substring-check each quote against its cited turn; drop any atom that fails. A judgment with no surviving evidence → that field returns `null`/`unclear` and contributes 0 to the score.

### 2c. Needs-attention score (Python, `analyze/score.py`)
Deterministic 0–100 from verified signals only:
```
unresolved / follow_up_promised .......... +35
explicit_dissatisfaction ................. +25
escalation_language ...................... +20
mood ends angry (+20) / frustrated (+10)
repeated_question (agent) ................ +15
negative mood shift & never recovers ..... +10
duration in top 10% ...................... +10
low caller_mos (≤2, audio failure proxy) . +5
→ clamp 0–100.  score_breakdown JSONB keeps every term + its quote.
```
`resolved` + positive end → naturally near 0.

## 3. Database — schema & migration

Alembic, one migration `0001_initial`. All tables plain (single-tenant hackathon). `psycopg` v3 driver: `postgresql+psycopg://...`.

```
agents            id PK, name UNIQUE, created_at
customers         id PK, name, created_at            -- name not unique (real dupes exist)
calls             id PK = sid (text),
                  customer_id FK, agent_id FK,
                  session text, started_at timestamptz, ended_at timestamptz,
                  duration_s int, caller_mos numeric, agent_mos numeric,
                  transcript_status text default 'pending',   -- pending|done|error
                  analysis_status  text default 'pending',
                  created_at
transcript_turns  id PK, call_id FK, idx int, speaker text,   -- agent|customer
                  start_s numeric, end_s numeric, text text
                  UNIQUE(call_id, idx);  index(call_id)
call_analysis     call_id PK/FK,
                  intent text, intent_evidence jsonb,
                  mood_timeline jsonb,                          -- [{t_seconds,mood,quote}]
                  mood_shift jsonb,                             -- {from,to,t_seconds,quote} | null
                  resolution text, resolution_evidence jsonb,
                  summary text,
                  needs_attention_score int, score_breakdown jsonb,
                  trending_issue_label text,
                  model text, prompt_version int, analyzed_at timestamptz
                  index(needs_attention_score), index(trending_issue_label)
```
Trends & per-agent views are `GROUP BY` queries over `calls` + `call_analysis` — no extra tables.
"Today" = configurable `?date=`; default = max `started_at::date` in the data (≈ 2020-05).

## 4. API (`api/`, FastAPI)

| Route | Returns |
|---|---|
| `GET /api/customers` | list: name, call count, last call, max attention score |
| `GET /api/customers/{id}` | customer + call history (each: sid, date, agent, duration, resolution, score, summary) |
| `GET /api/calls/{sid}` | **full contract**: transcript (turns w/ speaker+timings), intent, mood_timeline, mood_shift, resolution, summary, needs_attention_score, all evidence quotes+timestamps |
| `GET /api/calls/{sid}/audio` | streams the mp3 |
| `GET /api/dashboard/attention?date=&limit=` | ranked calls needing a manager today (score desc) w/ reason chips |
| `GET /api/dashboard/trends?date=&window=7` | issue label → count, week-over-week delta |
| `GET /api/dashboard/agents` | per agent: call volume, avg handle time, resolved %, avg attention score |

CORS open for localhost. Config via `pydantic-settings` reading `../.env` (already has `DATABASE_URL`, `AZURE_OPENAI_*`, `GPT_DEPLOYMENT`).

## 5. Dashboard (`web/`, Next.js 15 + Tailwind, App Router)

Minimal, product-shaped — inspiration from Gong / Observe.ai / Dialpad conversation-intelligence UIs:

1. **`/` — Needs a Manager's Attention Today**: ranked cards, big score dial, reason chips ("Unresolved", "Escalation language", "Asked 3×"), click → call. Header stat tiles: calls today, unresolved %, avg score. Right rail: **Trending Issues** (bar list w/ ▲▼ vs last week).
2. **`/agents`** — table: volume, avg handle time, resolved %, avg attention (sortable).
3. **`/customers`** — searchable list → **`/customers/[id]`** call history timeline.
4. **`/calls/[sid]`** — the money screen:
   - HTML5 `<audio>` player (seekable) fed by `/audio`.
   - **Mood timeline** — horizontal strip, coloured by mood, marker at shift point; click a point → seeks audio + scrolls transcript.
   - **Transcript** — agent left / customer right bubbles, `mm:ss` per turn, click to seek. Evidence turns highlighted.
   - Right panel: intent, summary, resolution badge, score dial, each with its quote + "@1:23" link.

Charts: lightweight inline SVG / CSS bars (no chart lib) to save time.

## 6. Repo layout

```
call-radar/
  .venv/                    (done)
  .env → symlink/copy of ../.env  (DATABASE_URL points at call_radar; add nothing secret)
  requirements.txt
  alembic.ini  alembic/versions/0001_initial.py
  app/
    config.py  db.py  models.py
    ingest/   run.py  audio.py  stt.py
    analyze/  run.py  prompts.py  schema.py  score.py  llm.py
    api/      main.py  routes_calls.py  routes_customers.py  routes_dashboard.py
  web/        (Next.js)
  scripts/    seed_demo.sh   (alembic upgrade + ingest --limit 200 + analyze)
  README.md   (run-from-scratch: venv → alembic upgrade → ingest → analyze → uvicorn → next dev)
```

## 7. Build order (checkpoints)

1. `config.py`, `db.py`, `models.py`, Alembic `0001` → `alembic upgrade head` against Azure. ✅ when tables exist.
2. `ingest/` → run `--limit 15` → verify `transcript_turns` populated & readable.
3. `analyze/` (prompt + schema + score) → run on those 15 → eyeball evidence quotes.
4. `api/` → hit `/api/calls/{sid}` and `/api/dashboard/attention`.
5. `web/` → 4 screens against live API.
6. Kick off `ingest --limit 250 && analyze` in background for demo volume; `--all` documented for graders.
7. README + `.gitignore` + `git init`.

## 8. Deliberately skipped (say so in README)

- No auth, no multi-tenant, no Docker (venv + `next dev` is the run path).
- No embeddings / RAG / vector search — not needed for this scope.
- Word-level transcript alignment (segment-level timings are enough for seek).
- Full 1,441-call transcription during the session — subset for demo, `--all` provided.
