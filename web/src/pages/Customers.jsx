import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, fmtDate, scoreColor } from "../api.js";

export default function Customers() {
  const [rows, setRows] = useState([]);
  const [q, setQ] = useState("");
  useEffect(() => { api.customers().then(setRows); }, []);
  const filtered = useMemo(
    () => rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );
  return (
    <div>
      <h1 className="text-2xl font-bold mb-3">Customers</h1>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name…"
        className="bg-slate-800 rounded px-3 py-1.5 text-sm mb-4 w-64" />
      <div className="grid grid-cols-2 gap-2">
        {filtered.map((c) => (
          <Link key={c.id} to={`/customers/${c.id}`}
            className="flex items-center justify-between bg-slate-900 border border-slate-800 hover:border-indigo-600 rounded-lg px-4 py-3">
            <div>
              <div className="font-medium">{c.name}</div>
              <div className="text-xs text-slate-500">
                {c.call_count} call{c.call_count !== 1 ? "s" : ""} · last {fmtDate(c.last_call_at)}
              </div>
            </div>
            <span className="text-sm font-bold" style={{ color: scoreColor(c.max_attention_score) }}>
              {c.max_attention_score}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
