import React, { useMemo, useRef, useState } from "react";
import { clock, MOOD_INK } from "../api.js";

const TONE_HEX = { cyan: "#2C6F81", green: "#3D7A4E", red: "#AC443B", amber: "#A96B12", ink: "#9C988B" };

/**
 * The hero. The conversation runs left→right on an axis between the AGENT and
 * CUSTOMER anchor pucks, over a faint receding floor grid (spatial depth without
 * a literal 3-D object). Flagged moments are nodes with drop-lines to labels.
 */
export default function ConversationField({
  duration, agent, customer, events, time, onSeek, onHover, hovered,
}) {
  const D = duration || 1;
  const boxRef = useRef(null);
  const [w, setW] = useState(960);
  const setRef = (el) => {
    boxRef.current = el;
    if (el && Math.abs(el.clientWidth - w) > 3) setW(el.clientWidth);
  };

  const H = 172, axisY = 126, horizonY = 34;
  const x0 = 76, x1 = w - 54;
  const span = x1 - x0;
  const cx = (x0 + x1) / 2;
  const at = (t) => x0 + Math.max(0, Math.min(1, t / D)) * span;

  // receding floor: horizontals bunching toward the horizon, verticals fanning in
  const floor = useMemo(() => {
    const hs = [];
    for (let i = 1; i <= 6; i++) {
      const f = i / 7;
      const y = axisY - (axisY - horizonY) * f * f;
      const inset = (f * f) * (span * 0.34);
      hs.push(`M ${x0 + inset} ${y} L ${x1 - inset} ${y}`);
    }
    const vs = [];
    for (let i = 0; i <= 10; i++) {
      const bx = x0 + (span * i) / 10;
      const tx = cx + (bx - cx) * 0.34;
      vs.push(`M ${bx} ${axisY} L ${tx} ${horizonY}`);
    }
    return { hs, vs };
  }, [w, D]);

  const placed = useMemo(() => {
    const sorted = [...events].sort((a, b) => a.t - b.t);
    let lastTier = {};
    return sorted.map((e) => {
      const x = at(e.t);
      // two label tiers; drop to tier 2 if tier-1 neighbour is close
      let tier = 1;
      if (lastTier[1] != null && x - lastTier[1] < 96) tier = 2;
      if (tier === 2 && lastTier[2] != null && x - lastTier[2] < 96) tier = 1;
      lastTier[tier] = x;
      return { ...e, x, tier };
    });
  }, [events, w, D]);

  const px = time != null ? at(time) : null;

  return (
    <div className="relative select-none" ref={setRef}>
      <div className="flex items-start justify-between mb-1">
        <Endpoint name={agent} role="Agent" align="left" />
        <div className="u-label pt-1">Conversation Field</div>
        <Endpoint name={customer} role="Customer" align="right" />
      </div>

      <svg viewBox={`0 0 ${w} ${H}`} width="100%" height={H}
        className="cursor-crosshair overflow-visible"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          onSeek?.(((e.clientX - r.left) / r.width) * D);
        }}>
        <defs>
          <filter id="cf-soft" x="-30%" y="-30%" width="160%" height="200%">
            <feDropShadow dx="0" dy="3" stdDeviation="3.5" floodColor="#26251F" floodOpacity="0.16" />
          </filter>
        </defs>

        {/* receding floor */}
        <g stroke="#26251F" strokeOpacity="0.045" strokeWidth="1">
          {floor.hs.map((d, i) => <path key={`h${i}`} d={d} />)}
          {floor.vs.map((d, i) => <path key={`v${i}`} d={d} />)}
        </g>

        {/* conversation axis */}
        <line x1={x0} y1={axisY} x2={x1} y2={axisY} stroke="#C7BFA8" strokeWidth="1.25" />
        <line x1={x0} y1={axisY + 4} x2={x1} y2={axisY + 4} stroke="#26251F" strokeOpacity="0.06" strokeWidth="3" />

        <Puck x={x0} y={axisY} />
        <Puck x={x1} y={axisY} />

        {placed.map((e, i) => {
          const on = hovered === e.key;
          const col = e.tone === "mood" ? MOOD_INK[e.mood] : TONE_HEX[e.tone] || "#9C988B";
          const labY = e.tier === 1 ? axisY - 30 : axisY - 56;
          const anchor = e.x < x0 + 60 ? "start" : e.x > x1 - 60 ? "end" : "middle";
          return (
            <g key={e.key || i}
              onMouseEnter={() => onHover?.(e.key)} onMouseLeave={() => onHover?.(null)}
              onClick={(ev) => { ev.stopPropagation(); onSeek?.(e.t); }}
              className="cursor-pointer">
              <line x1={e.x} y1={axisY} x2={e.x} y2={labY + 6}
                stroke={on ? col : "#C7BFA8"} strokeWidth="1" />
              <circle cx={e.x} cy={axisY} r={on ? 5.5 : 3.4} fill={col}
                stroke="#FBF9F3" strokeWidth="1.5" filter="url(#cf-soft)" />
              <text x={e.x} y={labY} textAnchor={anchor}
                className="font-mono uppercase" fontSize="8.5"
                fill={on ? "#26251F" : "#5A584F"} letterSpacing="0.09em">
                {String(e.label).slice(0, 26)}
              </text>
              <text x={e.x} y={labY - 10} textAnchor={anchor}
                className="font-mono" fontSize="8" fill="#B0A98F">{clock(e.t)}</text>
            </g>
          );
        })}

        {px != null && (
          <g>
            <line x1={px} y1={horizonY + 10} x2={px} y2={axisY + 16} stroke="#2C6F81" strokeWidth="1.5" />
            <circle cx={px} cy={axisY} r="2.5" fill="#2C6F81" />
          </g>
        )}
      </svg>
    </div>
  );
}

const Puck = ({ x, y }) => (
  <g>
    <ellipse cx={x} cy={y + 5} rx="7" ry="2.5" fill="#26251F" fillOpacity="0.14" />
    <line x1={x} y1={y} x2={x} y2={y - 9} stroke="#8A8472" strokeWidth="1.25" />
    <circle cx={x} cy={y - 11} r="4" fill="#FBF9F3" stroke="#5A584F" strokeWidth="1.4" />
    <circle cx={x} cy={y - 11} r="1.5" fill="#5A584F" />
  </g>
);

function Endpoint({ name, role, align }) {
  return (
    <div className={align === "right" ? "text-right" : "text-left"}>
      <div className="u-label mb-1">{role}</div>
      <div className="font-serif text-[15px] text-ink leading-none">{name}</div>
    </div>
  );
}
