import React from "react";
import { MOOD_COLOR, scoreColor, RES_COLOR, fmtDur } from "./api.js";

export function ScoreDial({ n, size = 72 }) {
  const r = size / 2 - 6;
  const c = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(100, n ?? 0)) / 100;
  return (
    <svg width={size} height={size} className="shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="#1e293b" strokeWidth="6" fill="none" />
      <circle
        cx={size / 2} cy={size / 2} r={r} stroke={scoreColor(n ?? 0)} strokeWidth="6" fill="none"
        strokeDasharray={c} strokeDashoffset={c * (1 - pct)} strokeLinecap="round"
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="52%" dominantBaseline="middle" textAnchor="middle"
        fill="#e5e7eb" fontSize={size / 3.4} fontWeight="700">
        {n ?? "–"}
      </text>
    </svg>
  );
}

export function ResBadge({ r }) {
  if (!r) return <span className="text-xs text-slate-500">not analyzed</span>;
  return (
    <span className={`text-xs px-2 py-0.5 rounded text-white ${RES_COLOR[r] || "bg-slate-600"}`}>
      {r.replace(/_/g, " ")}
    </span>
  );
}

/** Horizontal mood strip. points: [{t_seconds, mood, quote}], dur seconds. */
export function MoodTimeline({ points, dur, shift, onSeek }) {
  if (!points?.length) return <div className="text-sm text-slate-500">No mood evidence.</div>;
  const D = dur || points[points.length - 1].t_seconds + 5 || 1;
  return (
    <div className="relative">
      <div className="h-8 rounded-md overflow-hidden flex">
        {points.map((p, i) => {
          const next = points[i + 1]?.t_seconds ?? D;
          const w = Math.max(2, ((next - p.t_seconds) / D) * 100);
          return (
            <button key={i} title={`${p.mood} @${fmtDur(p.t_seconds)} — ${p.quote}`}
              onClick={() => onSeek?.(p.t_seconds)}
              style={{ width: `${w}%`, background: MOOD_COLOR[p.mood] || "#64748b" }}
              className="h-full hover:brightness-125 transition" />
          );
        })}
      </div>
      {shift?.t_seconds != null && (
        <div className="absolute -top-1 -bottom-1" style={{ left: `${(shift.t_seconds / D) * 100}%` }}>
          <div className="w-0.5 h-10 bg-white" />
          <div className="text-[10px] text-white bg-black/70 px-1 rounded whitespace-nowrap -translate-x-1/2">
            {shift.from_mood}→{shift.to_mood}
          </div>
        </div>
      )}
      <div className="flex gap-3 mt-3 flex-wrap text-xs text-slate-400">
        {points.map((p, i) => (
          <span key={i} className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full" style={{ background: MOOD_COLOR[p.mood] }} />
            {p.mood} @{fmtDur(p.t_seconds)}
          </span>
        ))}
      </div>
    </div>
  );
}

export function Evidence({ ev, onSeek }) {
  if (!ev?.quote) return <span className="text-xs text-slate-500 italic">no verified evidence</span>;
  return (
    <button onClick={() => onSeek?.(ev.t_seconds)}
      className="text-left text-xs bg-slate-800/70 hover:bg-slate-700 rounded px-2 py-1 border-l-2 border-indigo-500">
      <span className="text-indigo-300 font-mono">@{fmtDur(ev.t_seconds)}</span>{" "}
      <span className="text-slate-300">“{ev.quote}”</span>
    </button>
  );
}

export function Bars({ rows, max, color = "#6366f1" }) {
  const m = max || Math.max(1, ...rows.map((r) => r.value));
  return (
    <div className="space-y-1.5">
      {rows.map((r, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-28 shrink-0 truncate text-slate-300">{r.label}</span>
          <div className="flex-1 bg-slate-800 rounded h-4">
            <div className="h-4 rounded" style={{ width: `${(r.value / m) * 100}%`, background: color }} />
          </div>
          <span className="w-14 text-right text-slate-400">{r.value}{r.extra}</span>
        </div>
      ))}
    </div>
  );
}
