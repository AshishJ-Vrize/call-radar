import React, { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtDur, fmtDate } from "../api.js";
import { ScoreDial, ResBadge, MoodTimeline, Evidence } from "../components.jsx";

export default function CallDetail() {
  const { sid } = useParams();
  const [c, setC] = useState(null);
  const audio = useRef(null);
  const [now, setNow] = useState(0);
  const turnRefs = useRef({});

  useEffect(() => { setC(null); api.call(sid).then(setC); }, [sid]);

  const seek = (t) => {
    if (t == null || !audio.current) return;
    audio.current.currentTime = t;
    audio.current.play();
  };

  if (!c) return <p className="text-slate-500">Loading…</p>;
  const a = c.analysis;
  const evTurns = new Set();
  if (a) {
    [a.intent_evidence, a.resolution_evidence, ...(a.mood_timeline || []),
     ...((a.score_breakdown?.breakdown || []).map((b) => b.evidence))]
      .forEach((e) => e?.turn_idx != null && evTurns.add(e.turn_idx));
  }

  return (
    <div>
      <Link to={`/customers/${c.customer.id}`} className="text-sm text-indigo-400">← {c.customer.name}</Link>
      <div className="flex items-start gap-4 mt-1 mb-4">
        <div className="flex-1">
          <h1 className="text-xl font-bold">{c.customer.name} · <span className="text-slate-400 font-normal">{c.agent}</span></h1>
          <p className="text-sm text-slate-500">
            {fmtDate(c.started_at)} · {fmtDur(c.duration_s)} · MOS caller {c.caller_mos ?? "–"} / agent {c.agent_mos ?? "–"}
            {a && <> · <span className="text-slate-400">{a.trending_issue_label}</span></>}
          </p>
        </div>
        {a && <div className="flex flex-col items-center"><ScoreDial n={a.needs_attention_score} /><span className="text-[11px] text-slate-500 mt-1">attention</span></div>}
      </div>

      <audio ref={audio} controls src={api.audioUrl(sid)} className="w-full mb-5"
        onTimeUpdate={(e) => setNow(e.target.currentTime)} />

      {a ? (
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 space-y-5">
            <section>
              <h2 className="font-semibold mb-2">Mood timeline</h2>
              <MoodTimeline points={a.mood_timeline} dur={c.duration_s} shift={a.mood_shift} onSeek={seek} />
            </section>
            <section>
              <h2 className="font-semibold mb-2">Transcript</h2>
              <div className="space-y-1.5 max-h-[520px] overflow-y-auto pr-2">
                {c.transcript.map((t) => {
                  const active = now >= t.start_s && now < t.end_s;
                  const isEv = evTurns.has(t.idx);
                  return (
                    <div key={t.idx} ref={(el) => (turnRefs.current[t.idx] = el)}
                      onClick={() => seek(t.start_s)}
                      className={`flex gap-2 text-sm rounded px-2 py-1 cursor-pointer ${
                        t.speaker === "agent" ? "" : "flex-row-reverse text-right"
                      } ${active ? "bg-indigo-900/50" : "hover:bg-slate-800/50"}`}>
                      <span className="font-mono text-[11px] text-slate-500 shrink-0 pt-0.5">{fmtDur(t.start_s)}</span>
                      <div className={`max-w-[78%] rounded-lg px-3 py-1.5 ${
                        t.speaker === "agent" ? "bg-slate-800" : "bg-indigo-950"
                      } ${isEv ? "ring-1 ring-amber-500/60" : ""}`}>
                        <span className="block text-[10px] uppercase tracking-wide text-slate-500">{t.speaker}</span>
                        {t.text}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </div>

          <div className="space-y-4">
            <Panel title="Intent">
              <p className="text-sm text-slate-200 mb-2">{a.intent}</p>
              <Evidence ev={a.intent_evidence} onSeek={seek} />
            </Panel>
            <Panel title="Summary">
              <p className="text-sm text-slate-200">{a.summary}</p>
            </Panel>
            <Panel title="Resolution">
              <div className="mb-2"><ResBadge r={a.resolution} /></div>
              <Evidence ev={a.resolution_evidence} onSeek={seek} />
            </Panel>
            <Panel title={`Attention score · ${a.needs_attention_score}`}>
              <div className="space-y-1.5">
                {(a.score_breakdown?.breakdown || []).map((b, i) => (
                  <div key={i}>
                    <div className="text-xs text-slate-300">{b.factor.replace(/_/g, " ")} <span className="text-slate-500">+{b.points}</span></div>
                    {b.evidence?.quote && <Evidence ev={b.evidence} onSeek={seek} />}
                    {b.evidence?.note && <div className="text-[11px] text-slate-500">{b.evidence.note}</div>}
                  </div>
                ))}
                {!(a.score_breakdown?.breakdown || []).length && <p className="text-xs text-slate-500">No escalation signals — clean call.</p>}
              </div>
            </Panel>
          </div>
        </div>
      ) : (
        <p className="text-slate-500">Analysis pending for this call. Transcript above.</p>
      )}
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-lg p-3">
      <h3 className="text-xs uppercase tracking-wide text-slate-500 mb-2">{title}</h3>
      {children}
    </div>
  );
}
