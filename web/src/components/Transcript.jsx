import React, { useEffect, useRef } from "react";
import { clock } from "../api.js";

/**
 * Editorial conversation timeline. Agent flush-left, customer indented right —
 * the alternation carries the rhythm. Timestamps are navigation. Evidence turns
 * carry a margin marker.
 */
export default function Transcript({ turns, time, onSeek, evidence, agent, customer }) {
  const wrap = useRef(null);
  const active = turns.findLast?.((t) => time >= t.start_s) ??
    [...turns].reverse().find((t) => time >= t.start_s);

  useEffect(() => {
    if (!active || !wrap.current) return;
    const el = wrap.current.querySelector(`[data-idx="${active.idx}"]`);
    if (el) el.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [active?.idx]);

  return (
    <div ref={wrap} className="space-y-6 max-h-[620px] overflow-y-auto pr-3 -mr-3">
      {turns.map((t) => {
        const isCust = t.speaker === "customer";
        const on = active?.idx === t.idx;
        const ev = evidence.get(t.idx);
        return (
          <div key={t.idx} data-idx={t.idx}
            className={`relative ${isCust ? "pl-[38%]" : "pr-[30%]"}`}>
            <div className={on ? "border-l-2 border-cyan -ml-4 pl-4" : ""}>
              <button onClick={() => onSeek?.(t.start_s)}
                className="font-mono text-[11px] tnum text-ink-3 hover:text-cyan block mb-1">
                {clock(t.start_s)}
              </button>
              <div className="u-label mb-1.5 flex items-center gap-1.5">
                {ev && <span className="w-1.5 h-1.5 rounded-full" style={{ background: ev.hex }} title={ev.note} />}
                {isCust ? customer : agent} · {t.speaker}
              </div>
              <p onClick={() => onSeek?.(t.start_s)}
                className={`text-[14.5px] leading-relaxed cursor-pointer transition-colors ${
                  on ? "text-ink" : "text-ink-2 hover:text-ink"
                }`}>
                {t.text}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
