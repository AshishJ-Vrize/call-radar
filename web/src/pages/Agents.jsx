import React, { useEffect, useMemo, useState } from "react";
import { api, clock, scoreBand, TONE_TEXT } from "../api.js";
import { Label, Loading } from "../components/ui.jsx";

const COLS = [
  ["agent", "Agent", "text-left"],
  ["calls", "Vol", "text-right"],
  ["avg_handle_time_s", "AHT", "text-right"],
  ["resolved_pct", "Resolved", "text-right"],
  ["avg_attention_score", "Attention", "text-right"],
];

export default function Agents() {
  const [rows, setRows] = useState(null);
  const [sort, setSort] = useState("calls");
  useEffect(() => { api.agents().then(setRows); }, []);

  const num = (v) => (v == null ? -1 : parseFloat(v));
  const sorted = useMemo(
    () => (rows ? [...rows].sort((a, b) => num(b[sort]) - num(a[sort])) : []),
    [rows, sort]
  );
  if (!rows) return <Loading />;
  const maxVol = Math.max(...rows.map((r) => r.calls));
  const maxAht = Math.max(...rows.map((r) => r.avg_handle_time_s || 0));

  return (
    <div>
      <h1 className="font-serif text-[30px] text-ink leading-tight">Agents</h1>
      <p className="text-[13px] text-ink-2 mt-1 mb-7">
        Handling volume, average handle time and outcome quality per agent.
      </p>

      <table className="w-full">
        <thead>
          <tr className="border-b border-hair-2">
            {COLS.map(([k, label, align]) => (
              <th key={k}
                onClick={() => k !== "agent" && setSort(k)}
                className={`${align} u-label pb-2 ${k !== "agent" ? "cursor-pointer hover:text-ink" : ""} ${
                  sort === k ? "text-ink" : ""
                }`}>
                {label}{sort === k ? " ↓" : ""}
              </th>
            ))}
            <th className="w-40" />
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => {
            const tone = scoreBand(r.avg_attention_score);
            return (
              <tr key={r.agent} className="border-b border-hair hover:bg-paper-2 transition-colors">
                <td className="py-3 font-serif text-[15px] text-ink">{r.agent}</td>
                <td className="py-3 text-right font-mono text-[13px] tnum text-ink">{r.calls}</td>
                <td className="py-3 text-right font-mono text-[13px] tnum text-ink-2">{clock(r.avg_handle_time_s)}</td>
                <td className="py-3 text-right font-mono text-[13px] tnum text-ink-2">
                  {r.resolved_pct == null ? "–" : `${r.resolved_pct}%`}
                </td>
                <td className={`py-3 text-right font-mono text-[13px] tnum ${TONE_TEXT[tone]}`}>
                  {r.avg_attention_score ?? "–"}
                </td>
                <td className="py-3 pl-4">
                  <div className="flex items-center gap-1.5">
                    <div className="w-24 h-[3px] bg-hair">
                      <div className="h-[3px] bg-ink-3" style={{ width: `${(r.calls / maxVol) * 100}%` }} />
                    </div>
                    <div className="w-12 h-[3px] bg-hair" title="avg handle time">
                      <div className="h-[3px] bg-cyan"
                        style={{ width: `${((r.avg_handle_time_s || 0) / maxAht) * 100}%` }} />
                    </div>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex gap-6 mt-3">
        <Label>▬ volume</Label><Label className="text-cyan">▬ handle time</Label>
      </div>
    </div>
  );
}
