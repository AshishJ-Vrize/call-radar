import React from "react";
import { TONE_TEXT, TONE_BG, scoreBand } from "../api.js";

/** tiny uppercase mono section label */
export const Label = ({ children, className = "" }) => (
  <div className={`u-label ${className}`}>{children}</div>
);

/** a run of numeric readouts separated by hairlines — replaces metric cards */
export function Readout({ items }) {
  return (
    <div className="flex flex-wrap items-stretch border-y border-hair divide-x divide-hair">
      {items.map((it) => (
        <div key={it.k} className="px-5 py-3 first:pl-0">
          <div className="u-label mb-1">{it.k}</div>
          <div className={`font-mono text-xl tnum ${it.tone ? TONE_TEXT[it.tone] : "text-ink"}`}>
            {it.v}
            {it.suffix && <span className="text-ink-3 text-xs ml-1">{it.suffix}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

/** score as a value + tick on a shared 0-100 baseline (no dial) */
export function ScoreTick({ n, width = 132 }) {
  const tone = scoreBand(n);
  const x = Math.max(0, Math.min(100, n ?? 0));
  return (
    <div className="flex items-center gap-2.5" title={`attention ${n}/100`}>
      <span className={`font-mono text-lg tnum ${TONE_TEXT[tone]}`}>
        {n == null ? "--" : String(n).padStart(2, "0")}
      </span>
      <svg width={width} height="14" className="overflow-visible shrink-0">
        <line x1="0" y1="7" x2={width} y2="7" stroke="#D0C9B4" strokeWidth="1" />
        {[20, 45].map((m) => (
          <line key={m} x1={(m / 100) * width} y1="4" x2={(m / 100) * width} y2="10"
            stroke="#E2DCCC" strokeWidth="1" />
        ))}
        <line x1={(x / 100) * width} y1="0" x2={(x / 100) * width} y2="14"
          stroke="currentColor" strokeWidth="2" className={TONE_TEXT[tone]} />
      </svg>
    </div>
  );
}

export function StatusTick({ resolution }) {
  const map = {
    resolved: ["✓", "text-green", "Resolved"],
    follow_up_promised: ["→", "text-cyan", "Follow-up promised"],
    unresolved: ["✕", "text-red", "Unresolved"],
    unclear: ["–", "text-ink-3", "Unclear"],
  };
  const [g, c, t] = map[resolution] || map.unclear;
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-widest ${c}`}>
      <span className="text-sm leading-none">{g}</span>
      {t}
    </span>
  );
}

export function Tag({ children, tone = "ink-3" }) {
  return (
    <span className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-wider text-ink-2">
      <span className={`w-1.5 h-1.5 ${TONE_BG[tone]}`} />
      {children}
    </span>
  );
}

/** horizontal ledger bar (trends, agent distributions) */
export function LedgerBar({ value, max, tone = "cyan", delta }) {
  const w = Math.max(1, (value / (max || 1)) * 100);
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-[3px] bg-hair">
        <div className={`h-[3px] ${TONE_BG[tone]}`} style={{ width: `${w}%` }} />
      </div>
      <span className="font-mono text-xs tnum text-ink w-6 text-right">{value}</span>
      {delta != null && delta !== 0 && (
        <span className={`font-mono text-[10px] tnum w-8 ${delta > 0 ? "text-amber" : "text-ink-3"}`}>
          {delta > 0 ? "▲" : "▼"}{Math.abs(delta)}
        </span>
      )}
    </div>
  );
}

export const Loading = () => (
  <div className="u-label py-20 text-center">acquiring signal…</div>
);

/** a call rendered as dots on a short conversation axis (for lists) */
export function MiniAxis({ events = [], duration = 1, width = 150 }) {
  return (
    <svg width={width} height="12" className="overflow-visible shrink-0">
      <line x1="0" y1="6" x2={width} y2="6" stroke="#D0C9B4" strokeWidth="1" />
      {events.map((e, i) => (
        <circle key={i} cx={Math.max(2, Math.min(width - 2, (e.t / duration) * width))} cy="6"
          r="2.5" fill={e.hex || "#9C988B"} />
      ))}
    </svg>
  );
}
