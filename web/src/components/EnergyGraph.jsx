import React, { useState } from "react";
import { clock, VALENCE, MOOD_INK } from "../api.js";

/**
 * Conversation Energy — the customer's mood valence along the call.
 * Calm baseline at neutral; the line lifts toward relief / positive, dips toward
 * frustration. Dots are the extracted mood moments; hovering one surfaces its line.
 */
export default function EnergyGraph({ timeline = [], shift, duration, time, onSeek }) {
  const D = duration || 1;
  const W = 960, H = 74, mid = 40, amp = 26;
  const [hover, setHover] = useState(null);

  const src = timeline.length ? timeline : [{ t_seconds: 0, mood: "neutral", quote: "" }];
  const pts = src
    .map((m) => ({
      x: Math.max(0, Math.min(1, (m.t_seconds ?? 0) / D)) * W,
      y: mid - (VALENCE[m.mood] ?? 0) * amp,
      ...m,
    }))
    .sort((a, b) => a.x - b.x);

  const chain = [{ ...pts[0], x: 0 }, ...pts, { ...pts[pts.length - 1], x: W }];
  const d = smooth(chain);
  const px = (time / D) * W;

  return (
    <div>
      <div className="flex justify-between u-label mb-1.5">
        <span>Conversation Energy</span>
        <span className="text-hair-2">relief ↑ · strain ↓</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={H} className="overflow-visible cursor-crosshair"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSeek?.(((e.clientX - r.left) / r.width) * D);
        }}>
        {/* neutral baseline */}
        <line x1="0" y1={mid} x2={W} y2={mid} stroke="#D0C9B4" strokeWidth="1" strokeDasharray="2 4" />
        {/* fill only between the curve and the baseline */}
        <path d={`${d} L ${W} ${mid} L 0 ${mid} Z`} fill="rgba(44,111,129,0.07)" />
        <path d={d} fill="none" stroke="#2C6F81" strokeWidth="1.5" />

        {shift?.t_seconds != null && (
          <line x1={(shift.t_seconds / D) * W} y1="2" x2={(shift.t_seconds / D) * W} y2={H - 2}
            stroke="#A96B12" strokeWidth="1" strokeDasharray="3 2" />
        )}

        {pts.map((p, i) => (
          <g key={i}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
            onClick={(e) => { e.stopPropagation(); onSeek?.(p.t_seconds); }} className="cursor-pointer">
            <circle cx={p.x} cy={p.y} r={hover === i ? 4.5 : 3}
              fill={MOOD_INK[p.mood]} stroke="#FAF8F2" strokeWidth="1.5" />
            {hover === i && (
              <text x={clampX(p.x)} y={p.y < mid ? p.y - 9 : p.y + 15} textAnchor="middle"
                className="font-mono uppercase" fontSize="8.5" fill="#26251F" letterSpacing="0.08em">
                {p.mood} · {clock(p.t_seconds)}
              </text>
            )}
          </g>
        ))}

        <line x1={px} y1="0" x2={px} y2={H} stroke="#2C6F81" strokeWidth="1" />
      </svg>
    </div>
  );
}

const clampX = (x) => Math.max(70, Math.min(890, x));

function smooth(p) {
  if (p.length < 2) return "";
  let d = `M ${p[0].x} ${p[0].y}`;
  for (let i = 0; i < p.length - 1; i++) {
    const a = p[i], b = p[i + 1];
    const cx = (a.x + b.x) / 2;
    d += ` C ${cx} ${a.y}, ${cx} ${b.y}, ${b.x} ${b.y}`;
  }
  return d;
}
