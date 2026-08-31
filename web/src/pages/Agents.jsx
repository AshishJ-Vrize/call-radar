import React, { useEffect, useState } from "react";
import { api, fmtDur } from "../api.js";
import { scoreColor } from "../api.js";

export default function Agents() {
  const [rows, setRows] = useState([]);
  const [sort, setSort] = useState("calls");
  useEffect(() => { api.agents().then(setRows); }, []);

  const num = (v) => (v == null ? -1 : parseFloat(v));
  const sorted = [...rows].sort((a, b) => num(b[sort]) - num(a[sort]));
  const cols = [
    ["agent", "Agent"], ["calls", "Calls"], ["avg_handle_time_s", "Avg handle time"],
    ["resolved_pct", "Resolved %"], ["avg_attention_score", "Avg attention"],
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-1">Agent Performance</h1>
      <p className="text-slate-400 text-sm mb-5">Volume, handle time and outcomes per agent.</p>
      <table className="w-full text-sm bg-slate-900 border border-slate-800 rounded-lg overflow-hidden">
        <thead className="bg-slate-950 text-slate-400">
          <tr>
            {cols.map(([k, label]) => (
              <th key={k} onClick={() => k !== "agent" && setSort(k)}
                className={`text-left px-4 py-2 ${k !== "agent" ? "cursor-pointer hover:text-slate-200" : ""}`}>
                {label}{sort === k ? " ↓" : ""}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r) => (
            <tr key={r.agent} className="border-t border-slate-800">
              <td className="px-4 py-2 font-medium">{r.agent}</td>
              <td className="px-4 py-2">{r.calls}</td>
              <td className="px-4 py-2">{fmtDur(r.avg_handle_time_s)}</td>
              <td className="px-4 py-2">{r.resolved_pct == null ? "–" : `${r.resolved_pct}%`}</td>
              <td className="px-4 py-2">
                {r.avg_attention_score == null ? "–" : (
                  <span style={{ color: scoreColor(r.avg_attention_score) }} className="font-semibold">
                    {r.avg_attention_score}
                  </span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
