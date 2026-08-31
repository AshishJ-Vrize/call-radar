import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, clock, stamp, factorLabel, MOOD_INK, RESOLUTION } from "../api.js";
import { useAudio, useWaveform } from "../audio.js";
import { Label, StatusTick, Loading } from "../components/ui.jsx";
import ConversationField from "../components/ConversationField.jsx";
import Waveform from "../components/Waveform.jsx";
import EnergyGraph from "../components/EnergyGraph.jsx";
import Transcript from "../components/Transcript.jsx";
import IntelRail from "../components/IntelRail.jsx";

export default function CallDetail() {
  const { sid } = useParams();
  const [c, setC] = useState(null);
  const [hovered, setHovered] = useState(null);
  const { time, duration: adur, playing, seek, toggle } = useAudio(api.audioUrl(sid));
  const peaks = useWaveform(api.audioUrl(sid));

  useEffect(() => { setC(null); api.call(sid).then(setC); }, [sid]);

  const duration = adur || c?.duration_s || 1;
  const a = c?.analysis;

  const events = useMemo(() => (a ? buildEvents(a) : []), [a]);
  const evidence = useMemo(() => (a ? buildEvidenceMap(a) : new Map()), [a]);

  if (!c) return <Loading />;

  return (
    <div>
      {/* contextual header */}
      <Link to={`/customers/${c.customer.id}`} className="u-label hover:text-cyan">← Calls</Link>
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-2 border-b border-hair-2 pb-5">
        <h1 className="font-serif text-[34px] leading-none text-ink">{c.customer.name}</h1>
        <div className="u-label pb-1">
          {c.agent} · {a?.trending_issue_label || c.session}
        </div>
        <div className="ml-auto flex items-center gap-6 pb-1">
          <span className="font-mono text-[11px] tnum text-ink-3">
            {stamp(c.started_at)} · {clock(c.duration_s)} · MOS {c.caller_mos ?? "–"}
          </span>
          {a && <StatusTick resolution={a.resolution} />}
        </div>
      </div>

      {/* hero instrument: field + transport + energy, one shared time scale */}
      <section className="mt-8 bg-paper-2 border border-hair px-6 pt-6 pb-5">
        <ConversationField
          duration={duration} agent={c.agent} customer={c.customer.name}
          events={events} time={time} onSeek={seek}
          hovered={hovered} onHover={setHovered}
        />
        <div className="mt-6 pt-5 border-t border-hair">
          <Waveform
            peaks={peaks} duration={duration} time={time} playing={playing}
            onToggle={toggle} onSeek={seek}
            marks={events.filter((e) => e.tone === "green" || e.tone === "red")}
          />
        </div>
        {a?.mood_timeline?.length > 0 && (
          <div className="mt-6 pt-5 border-t border-hair">
            <EnergyGraph timeline={a.mood_timeline} shift={a.mood_shift}
              duration={duration} time={time} onSeek={seek} />
          </div>
        )}
      </section>

      {/* transcript + intelligence */}
      <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
        <section>
          <Label className="mb-5">Transcript</Label>
          <Transcript turns={c.transcript} time={time} onSeek={seek}
            evidence={evidence} agent={c.agent} customer={c.customer.name} />
        </section>
        <aside className="lg:border-l lg:border-hair lg:pl-8">
          <Label className="mb-4">Intelligence</Label>
          <div className="lg:sticky lg:top-20">
            <IntelRail analysis={a} onSeek={seek} hovered={hovered} onHover={setHovered} />
          </div>
        </aside>
      </div>
    </div>
  );
}

/* ---- derive the conversation-field nodes from the analysis ---------------- */
const EVENT_RANK = { green: 5, red: 5, amber: 4, cyan: 3, mood: 1 };

function buildEvents(a) {
  const out = [];
  const push = (t, label, tone, extra = {}) => {
    if (t == null) return;
    out.push({ key: extra.key || `${label}-${Math.round(t)}`, t, label, tone, ...extra });
  };
  if (a.intent_evidence) push(a.intent_evidence.t_seconds, a.trending_issue_label || "Intent", "cyan");
  (a.mood_timeline || []).forEach((m) =>
    push(m.t_seconds, m.mood, "mood", { mood: m.mood, quote: m.quote })
  );
  if (a.mood_shift)
    push(a.mood_shift.t_seconds, `${a.mood_shift.from_mood} to ${a.mood_shift.to_mood}`, "amber",
      { key: "shift" });
  (a.score_breakdown?.breakdown || []).forEach((f) => {
    if (f.evidence?.t_seconds != null)
      push(f.evidence.t_seconds, factorLabel(f.factor), f.factor === "long_call" ? "amber" : "red",
        { key: `f:${f.factor}` });
  });
  if (a.resolution_evidence) {
    const res = RESOLUTION[a.resolution] || RESOLUTION.unclear;
    push(a.resolution_evidence.t_seconds, res.label,
      a.resolution === "resolved" ? "green" : a.resolution === "unresolved" ? "red" : "cyan",
      { key: "outcome" });
  }
  // when two moments land on the same second, keep the higher-ranked one
  const byT = new Map();
  for (const e of out) {
    const k = Math.round(e.t);
    const cur = byT.get(k);
    if (!cur || (EVENT_RANK[e.tone] || 0) > (EVENT_RANK[cur.tone] || 0)) byT.set(k, e);
  }
  return [...byT.values()].sort((x, y) => x.t - y.t);
}

function buildEvidenceMap(a) {
  const m = new Map();
  const add = (ev, hex, note) => {
    if (ev?.turn_idx == null) return;
    if (!m.has(ev.turn_idx)) m.set(ev.turn_idx, { hex, note });
  };
  add(a.intent_evidence, "#2C6F81", "intent");
  add(a.resolution_evidence, a.resolution === "resolved" ? "#3D7A4E" : "#AC443B", "outcome");
  (a.mood_timeline || []).forEach((x) => add(x, MOOD_INK[x.mood], `mood: ${x.mood}`));
  (a.score_breakdown?.breakdown || []).forEach((f) =>
    add(f.evidence, "#A96B12", factorLabel(f.factor))
  );
  return m;
}
