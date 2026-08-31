import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDur, fmtDay } from "../api.js";
import { ScoreDial, ResBadge, Bars } from "../components.jsx";

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
    api.attention(date).then(setData);
    api.trends(date).then(setTrends);
  }, [meta, date]);

  const items = data?.items || [];
  const unresolved = items.filter((i) => i.resolution === "unresolved").length;
  const avg = items.length ? Math.round(items.reduce((s, i) => s + (i.score || 0), 0) / items.length) : 0;

  return (
    <div>
      <div className="flex items-end justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold">Needs a Manager's Attention</h1>
          <p className="text-slate-400 text-sm">Ranked by evidence-backed attention score.</p>
        </div>
        <label className="text-sm text-slate-400">
          Day{" "}
          <select value={date} onChange={(e) => setDate(e.target.value)}
            className="bg-slate-800 rounded px-2 py-1 text-slate-200">
            <option value="">all time</option>
            {meta?.available_dates?.map((d) => (
              <option key={d} value={d}>{fmtDay(d)}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-4 gap-3 mb-6">
        {[
          ["Calls", items.length],
          ["Unresolved", unresolved],
          ["Avg score", avg],
          ["Analyzed / total", `${meta?.analyzed_calls ?? "–"} / ${meta?.total_calls ?? "–"}`],
        ].map(([k, v]) => (
          <div key={k} className="bg-slate-900 border border-slate-800 rounded-lg p-3">
            <div className="text-2xl font-bold">{v}</div>
            <div className="text-xs text-slate-400">{k}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 space-y-3">
          {items.map((it) => (
            <Link key={it.sid} to={`/calls/${it.sid}`}
              className="flex gap-4 bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-lg p-4">
              <ScoreDial n={it.score} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold">{it.customer}</span>
                  <ResBadge r={it.resolution} />
                  <span className="text-xs text-slate-500">
                    {it.agent} · {fmtDur(it.duration_s)} · {it.issue}
                  </span>
                </div>
                <p className="text-sm text-slate-300 line-clamp-2">{it.summary}</p>
                <div className="flex gap-1.5 mt-2 flex-wrap">
                  {it.reasons?.map((r, i) => (
                    <span key={i} title={r.quote || ""}
                      className="text-[11px] bg-slate-800 text-slate-300 rounded px-1.5 py-0.5">
                      {r.factor.replace(/_/g, " ")} +{r.points}
                    </span>
                  ))}
                </div>
              </div>
            </Link>
          ))}
          {!items.length && <p className="text-slate-500">No analyzed calls for this day.</p>}
        </div>

        <div>
          <h2 className="font-semibold mb-2">Trending Issues</h2>
          <p className="text-xs text-slate-500 mb-3">
            last {trends?.window_days || 7} days vs prior {trends?.window_days || 7}
          </p>
          <Bars
            rows={(trends?.issues || []).slice(0, 12).map((i) => ({
              label: i.label,
              value: i.count,
              extra: i.delta ? ` ${i.delta > 0 ? "▲" : "▼"}${Math.abs(i.delta)}` : "",
            }))}
          />
        </div>
      </div>
    </div>
  );
}
