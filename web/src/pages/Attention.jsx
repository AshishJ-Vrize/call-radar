import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, clock, day, factorLabel, scoreBand, TONE_TEXT } from "../api.js";
import { Label, Readout, ScoreTick, StatusTick, LedgerBar, Loading, MiniAxis } from "../components/ui.jsx";

export default function Attention() {
  const [meta, setMeta] = useState(null);
  const [date, setDate] = useState("");
  const [data, setData] = useState(null);
  const [trends, setTrends] = useState(null);

  useEffect(() => {
    api.meta().then((m) => { setMeta(m); setDate(m.default_date || ""); });
  }, []);
  useEffect(() => {
    if (!meta) return;
    setData(null);
    api.attention(date).then(setData);
    api.trends(date, 90).then(setTrends);
  }, [meta, date]);

  const items = data?.items || [];
  const unresolved = items.filter((i) => i.resolution === "unresolved").length;
  const flagged = items.filter((i) => (i.score || 0) >= 20).length;
  const median = items.length
    ? [...items].map((i) => i.score || 0).sort((a, b) => a - b)[Math.floor(items.length / 2)]
    : 0;
  const maxTrend = Math.max(1, ...(trends?.issues || []).map((i) => i.count));

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-[30px] text-ink leading-tight">Watch List</h1>
          <p className="text-[13px] text-ink-2 mt-1">
            Calls a manager should hear today, ranked by evidence-weighted attention.
          </p>
        </div>
        <label className="u-label flex items-center gap-2">
          Window
          <select value={date} onChange={(e) => setDate(e.target.value)}
            className="bg-transparent border-b border-hair-2 text-ink font-mono text-[11px] py-1 focus:outline-none">
            <option value="">all time</option>
            {meta?.available_dates?.map((d) => <option key={d} value={d}>{day(d)}</option>)}
          </select>
        </label>
      </div>

      <Readout items={[
        { k: "In view", v: items.length },
        { k: "Unresolved", v: unresolved, tone: unresolved ? "red" : "green" },
        { k: "Flagged ≥20", v: flagged, tone: flagged ? "amber" : "green" },
        { k: "Median score", v: String(median).padStart(2, "0") },
        { k: "Dataset", v: `${meta?.analyzed_calls ?? "–"}`, suffix: `/ ${meta?.total_calls ?? "–"}` },
      ]} />

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_300px] gap-10 mt-8">
        {/* ledger */}
        <div>
          {!data && <Loading />}
          <ol>
            {items.map((it, i) => {
              const tone = scoreBand(it.score);
              const axisEvents = (it.reasons || [])
                .filter((r) => r.t_seconds != null)
                .map((r) => ({ t: r.t_seconds, hex: "#A96B12" }));
              return (
                <li key={it.sid} className="border-b border-hair last:border-0">
                  <Link to={`/calls/${it.sid}`}
                    className="group grid grid-cols-[28px_1fr] gap-4 py-4 hover:bg-paper-2 -mx-3 px-3 transition-colors">
                    <span className="font-mono text-[13px] tnum text-ink-3 pt-0.5">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-3 flex-wrap">
                        <span className="font-serif text-[17px] text-ink">{it.customer}</span>
                        <StatusTick resolution={it.resolution} />
                        <span className="u-label">{it.agent} · {clock(it.duration_s)} · {it.issue}</span>
                      </div>
                      <p className="text-[13px] text-ink-2 mt-1.5 leading-snug max-w-2xl">{it.summary}</p>
                      <div className="flex items-center gap-5 mt-3">
                        <ScoreTick n={it.score} />
                        <MiniAxis events={axisEvents} duration={it.duration_s || 1} width={120} />
                        <div className="flex gap-3 flex-wrap">
                          {(it.reasons || []).slice(0, 3).map((r, k) => (
                            <span key={k} className={`font-mono text-[10px] uppercase tracking-wider ${TONE_TEXT[tone]}`}>
                              {factorLabel(r.factor)}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ol>
          {data && !items.length && <p className="u-label py-16 text-center">no analysed calls in window</p>}
        </div>

        {/* trending rail */}
        <div className="xl:border-l xl:border-hair xl:pl-8">
          <Label className="mb-1">Trending Issues</Label>
          <p className="text-[11px] text-ink-3 mb-4">
            volume across the dataset · ▲ vs prior window
          </p>
          <div className="space-y-3">
            {(trends?.issues || []).slice(0, 10).map((iss) => (
              <div key={iss.label}>
                <div className="text-[12px] text-ink mb-1 capitalize">{iss.label}</div>
                <LedgerBar value={iss.count} max={maxTrend} tone="cyan" delta={iss.delta} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
