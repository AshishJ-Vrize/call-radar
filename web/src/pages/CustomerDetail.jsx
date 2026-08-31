import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, fmtDate, fmtDur } from "../api.js";
import { ScoreDial, ResBadge } from "../components.jsx";

export default function CustomerDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  useEffect(() => { api.customer(id).then(setC); }, [id]);
  if (!c) return <p className="text-slate-500">Loading…</p>;
  return (
    <div>
      <Link to="/customers" className="text-sm text-indigo-400">← Customers</Link>
      <h1 className="text-2xl font-bold mt-1 mb-4">{c.name}</h1>
      <div className="space-y-3">
        {c.calls.map((call) => (
          <Link key={call.sid} to={`/calls/${call.sid}`}
            className="flex gap-4 items-center bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-lg p-4">
            <ScoreDial n={call.needs_attention_score} size={56} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm text-slate-400">{fmtDate(call.started_at)}</span>
                <ResBadge r={call.resolution} />
                <span className="text-xs text-slate-500">{call.agent} · {fmtDur(call.duration_s)} · {call.trending_issue_label}</span>
              </div>
              <p className="text-sm text-slate-300 line-clamp-2">{call.summary || "—"}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
