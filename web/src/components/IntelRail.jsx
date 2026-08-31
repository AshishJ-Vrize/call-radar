import React from "react";
import { clock, factorLabel, RESOLUTION, MOOD_INK, TONE_TEXT } from "../api.js";
import { StatusTick } from "./ui.jsx";

/**
 * The intelligence layer — margin annotations on the conversation, not cards.
 * Every line that rests on evidence is a button back to that moment.
 */
export default function IntelRail({ analysis, onSeek, hovered, onHover }) {
  const a = analysis;
  if (!a) return <div className="u-label">analysis pending</div>;

  const factors = a.score_breakdown?.breakdown || [];
  const lastMood = a.mood_timeline?.[a.mood_timeline.length - 1]?.mood || "neutral";
  const has = (f) => factors.some((x) => x.factor === f);
  const risk = a.needs_attention_score >= 45 ? ["High", "red"]
    : a.needs_attention_score >= 20 ? ["Elevated", "amber"]
    : ["Low", "green"];
  const effort = has("repeated_question") ? ["High", "red"]
    : has("long_call") ? ["Moderate", "amber"] : ["Low", "green"];

  return (
    <div className="divide-y divide-hair">
      <Row k="Intent">
        <p className="text-[13.5px] text-ink leading-snug">{a.intent}</p>
        {a.intent_evidence && <Cite ev={a.intent_evidence} onSeek={onSeek} />}
      </Row>

      <Row k="Summary">
        <p className="text-[13px] text-ink-2 leading-relaxed">{a.summary}</p>
      </Row>

      <Row k="Outcome">
        <StatusTick resolution={a.resolution} />
        {a.resolution_evidence && <Cite ev={a.resolution_evidence} onSeek={onSeek} />}
      </Row>

      <Row k="Signals">
        <Signal label="Sentiment" value={cap(lastMood)} hex={MOOD_INK[lastMood]} />
        <Signal label="Risk" value={risk[0]} tone={risk[1]} />
        <Signal label="Effort" value={effort[0]} tone={effort[1]} />
      </Row>

      {factors.length > 0 && (
        <Row k={`Attention · ${a.needs_attention_score}`}>
          <div className="space-y-2">
            {factors.map((f, i) => (
              <button key={i}
                onMouseEnter={() => onHover?.(`f:${f.factor}`)}
                onMouseLeave={() => onHover?.(null)}
                onClick={() => f.evidence?.t_seconds != null && onSeek?.(f.evidence.t_seconds)}
                className={`w-full text-left group ${hovered === `f:${f.factor}` ? "opacity-100" : ""}`}>
                <div className="flex items-baseline justify-between">
                  <span className="text-[12px] text-ink">{factorLabel(f.factor)}</span>
                  <span className="font-mono text-[11px] text-ink-3">+{f.points}</span>
                </div>
                {f.evidence?.quote && (
                  <div className="text-[11px] text-ink-3 group-hover:text-cyan leading-snug mt-0.5">
                    <span className="font-mono">{clock(f.evidence.t_seconds)}</span> · “{f.evidence.quote}”
                  </div>
                )}
              </button>
            ))}
          </div>
        </Row>
      )}
    </div>
  );
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

function Row({ k, children }) {
  return (
    <div className="py-4 first:pt-0">
      <div className="u-label mb-2">{k}</div>
      {children}
    </div>
  );
}

function Signal({ label, value, tone, hex }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[12px] text-ink-2">{label}</span>
      <span className={`text-[12px] font-medium flex items-center gap-1.5 ${tone ? TONE_TEXT[tone] : "text-ink"}`}>
        {hex && <span className="w-1.5 h-1.5 rounded-full" style={{ background: hex }} />}
        {value}
      </span>
    </div>
  );
}

function Cite({ ev, onSeek }) {
  return (
    <button onClick={() => onSeek?.(ev.t_seconds)}
      className="mt-1.5 text-left text-[11px] text-ink-3 hover:text-cyan leading-snug block">
      <span className="font-mono">{clock(ev.t_seconds)}</span> · “{ev.quote}”
    </button>
  );
}
