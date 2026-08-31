import React, { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, stamp, clock } from "../api.js";
import { Label, ScoreTick, StatusTick, Loading } from "../components/ui.jsx";

export default function CustomerDetail() {
  const { id } = useParams();
  const [c, setC] = useState(null);
  useEffect(() => { setC(null); api.customer(id).then(setC); }, [id]);
  if (!c) return <Loading />;

  const scored = c.calls.filter((x) => x.needs_attention_score != null);
  const peak = scored.length ? Math.max(...scored.map((x) => x.needs_attention_score)) : null;

  return (
    <div>
      <Link to="/customers" className="u-label hover:text-cyan">← Customers</Link>
      <div className="mt-3 flex flex-wrap items-end gap-x-8 gap-y-2 border-b border-hair-2 pb-5">
        <h1 className="font-serif text-[32px] leading-none text-ink">{c.name}</h1>
        <div className="u-label pb-1">
          {c.calls.length} calls on file · peak attention {peak == null ? "–" : peak}
        </div>
      </div>

      <Label className="mt-8 mb-3">Call history</Label>
      <ol>
        {c.calls.map((call) => {
          return (
            <li key={call.sid} className="border-b border-hair last:border-0">
              <Link to={`/calls/${call.sid}`}
                className="group grid grid-cols-1 md:grid-cols-[150px_1fr_auto] gap-x-6 gap-y-2 py-4 hover:bg-paper-2 -mx-3 px-3 transition-colors">
                <div className="font-mono text-[11px] tnum text-ink-3 pt-0.5">
                  {stamp(call.started_at)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-3 flex-wrap">
                    <StatusTick resolution={call.resolution} />
                    <span className="u-label">
                      {call.agent} · {clock(call.duration_s)} · {call.trending_issue_label}
                    </span>
                  </div>
                  <p className="text-[13px] text-ink-2 mt-1.5 leading-snug max-w-2xl">
                    {call.summary || "—"}
                  </p>
                </div>
                <div className="md:pt-1">
                  <ScoreTick n={call.needs_attention_score} width={96} />
                </div>
              </Link>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
