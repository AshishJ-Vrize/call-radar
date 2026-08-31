import React, { useRef } from "react";
import { clock } from "../api.js";

/**
 * Custom transport. Waveform doubles as the scrub bar and shares the call's
 * horizontal time scale with the conversation field above it.
 */
export default function Waveform({ peaks, duration, time, playing, onToggle, onSeek, marks = [] }) {
  const D = duration || 1;
  const box = useRef(null);
  const H = 56;
  const N = peaks ? peaks.length : 0;

  const seekAt = (clientX) => {
    const r = box.current.getBoundingClientRect();
    onSeek?.(Math.max(0, Math.min(1, (clientX - r.left) / r.width)) * D);
  };

  const progress = time / D;

  return (
    <div className="flex items-center gap-4">
      <button onClick={onToggle}
        className="shrink-0 w-11 h-11 border border-ink text-ink hover:bg-ink hover:text-paper transition-colors grid place-items-center"
        aria-label={playing ? "pause" : "play"}>
        {playing ? (
          <span className="flex gap-[3px]"><i className="w-[3px] h-3.5 bg-current block" /><i className="w-[3px] h-3.5 bg-current block" /></span>
        ) : (
          <span className="border-y-[7px] border-y-transparent border-l-[11px] border-l-current ml-0.5" />
        )}
      </button>

      <span className="font-mono text-xs tnum text-ink w-12">{clock(time)}</span>

      <div ref={box} className="relative flex-1 cursor-pointer group" style={{ height: H }}
        onClick={(e) => seekAt(e.clientX)}>
        <svg width="100%" height={H} viewBox={`0 0 ${Math.max(N, 120)} ${H}`} preserveAspectRatio="none">
          {peaks
            ? [...peaks].map((p, i) => {
                const h = Math.max(2, Math.pow(p, 0.8) * (H - 4));
                const played = i / N <= progress;
                return (
                  <line key={i} x1={i + 0.5} x2={i + 0.5} y1={(H - h) / 2} y2={(H + h) / 2}
                    stroke={played ? "#26251F" : "#C4BCA1"} strokeWidth="1" />
                );
              })
            : Array.from({ length: 120 }).map((_, i) => (
                <line key={i} x1={i + 0.5} x2={i + 0.5} y1={H / 2 - 2} y2={H / 2 + 2}
                  stroke="#DDD6C4" strokeWidth="1" />
              ))}
        </svg>

        {/* event ticks aligned to the same scale */}
        {marks.map((m, i) => (
          <span key={i} title={`${m.label} · ${clock(m.t)}`}
            className="absolute top-0 w-px bg-cyan/60"
            style={{ left: `${(m.t / D) * 100}%`, height: 7 }} />
        ))}

        {/* playhead */}
        <span className="absolute -top-1 -bottom-1 w-px bg-cyan"
          style={{ left: `${progress * 100}%` }}>
          <span className="absolute -top-1 -left-[3px] w-[7px] h-[7px] bg-cyan rotate-45" />
        </span>
      </div>

      <span className="font-mono text-xs tnum text-ink-3 w-12 text-right">{clock(duration)}</span>
    </div>
  );
}
