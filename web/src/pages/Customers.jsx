import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api, day, scoreBand, TONE_TEXT } from "../api.js";
import { Loading } from "../components/ui.jsx";

export default function Customers() {
  const [rows, setRows] = useState(null);
  const [q, setQ] = useState("");
  useEffect(() => { api.customers().then(setRows); }, []);
  const filtered = useMemo(
    () => (rows || []).filter((r) => r.name.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );
  if (!rows) return <Loading />;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="font-serif text-[30px] text-ink leading-tight">Customers</h1>
          <p className="text-[13px] text-ink-2 mt-1">
            {rows.length} people · sorted by peak attention across their calls.
          </p>
        </div>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="filter by name"
          className="bg-transparent border-b border-hair-2 focus:border-ink text-ink text-[13px] py-1 w-52 focus:outline-none placeholder:text-ink-3" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 md:gap-x-10">
        {filtered.map((c, i) => {
          const tone = scoreBand(c.max_attention_score);
          return (
            <Link key={c.id} to={`/customers/${c.id}`}
              className={`group flex items-baseline gap-4 py-3 border-b border-hair hover:bg-paper-2 -mx-3 px-3 transition-colors ${
                i % 2 === 0 ? "md:border-r md:border-hair md:pr-10 md:-mr-px" : ""
              }`}>
              <span className="font-serif text-[15px] text-ink group-hover:text-cyan flex-1 truncate">
                {c.name}
              </span>
              <span className="font-mono text-[10px] uppercase tracking-wider text-ink-3">
                {c.call_count} call{c.call_count !== 1 ? "s" : ""} · {day(c.last_call_at)}
              </span>
              <span className={`font-mono text-[13px] tnum w-6 text-right ${TONE_TEXT[tone]}`}>
                {String(c.max_attention_score).padStart(2, "0")}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
