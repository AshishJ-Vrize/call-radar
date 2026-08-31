const j = (u) =>
  fetch(u).then((r) => {
    if (!r.ok) throw new Error(`${r.status} ${u}`);
    return r.json();
  });

export const api = {
  meta: () => j("/api/dashboard/meta"),
  attention: (date, limit = 40) =>
    j(`/api/dashboard/attention?limit=${limit}${date ? `&date=${date}` : ""}`),
  trends: (date, window = 7) =>
    j(`/api/dashboard/trends?window=${window}${date ? `&date=${date}` : ""}`),
  agents: () => j("/api/dashboard/agents"),
  customers: () => j("/api/customers"),
  customer: (id) => j(`/api/customers/${id}`),
  call: (sid) => j(`/api/calls/${sid}`),
  audioUrl: (sid) => `/api/calls/${sid}/audio`,
};

/* ---- formatting ---------------------------------------------------------- */
export const clock = (s) => {
  if (s == null) return "--:--";
  const m = Math.floor(s / 60);
  const ss = Math.floor(s % 60);
  return `${String(m).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
};
export const secs = (s) => (s == null ? "--" : `${Math.round(s)}s`);
export const stamp = (iso) => {
  if (!iso) return "--";
  const d = new Date(iso);
  return d
    .toLocaleString("en-GB", {
      year: "numeric", month: "short", day: "2-digit",
      hour: "2-digit", minute: "2-digit", hour12: false,
    })
    .replace(",", " ·");
};
export const day = (iso) =>
  iso ? new Date(iso).toLocaleDateString("en-GB", { year: "numeric", month: "short", day: "2-digit" }) : "--";

/* ---- semantics --------------------------------------------------------- */
// customer-mood valence for the energy curve
export const VALENCE = {
  angry: -2, frustrated: -1.15, anxious: -0.55,
  neutral: 0, relieved: 0.9, positive: 1.5,
};
export const MOOD_INK = {
  angry: "#AC443B", frustrated: "#B4633B", anxious: "#A96B12",
  neutral: "#9C988B", relieved: "#3D7A4E", positive: "#2E7D57",
};

export const RESOLUTION = {
  resolved: { label: "Resolved", tone: "green" },
  follow_up_promised: { label: "Follow-up promised", tone: "cyan" },
  unresolved: { label: "Unresolved", tone: "red" },
  unclear: { label: "Unclear", tone: "ink-3" },
};

export const scoreBand = (n) =>
  n == null ? "ink-3" : n >= 45 ? "red" : n >= 20 ? "amber" : n >= 8 ? "cyan" : "green";

export const factorLabel = (f) =>
  ({
    unresolved: "Left unresolved",
    follow_up_promised: "Follow-up only",
    explicit_dissatisfaction: "Voiced dissatisfaction",
    escalation_language: "Escalation language",
    repeated_question: "Repeated question",
    negative_mood_shift: "Mood turned negative",
    long_call: "Long handle time",
    poor_audio_quality: "Poor line quality",
    ends_frustrated: "Ended frustrated",
    ends_angry: "Ended angry",
    ends_anxious: "Ended anxious",
  })[f] || f.replace(/_/g, " ");

export const TONE_TEXT = {
  green: "text-green", red: "text-red", amber: "text-amber", cyan: "text-cyan", "ink-3": "text-ink-3",
};
export const TONE_BG = {
  green: "bg-green", red: "bg-red", amber: "bg-amber", cyan: "bg-cyan", "ink-3": "bg-ink-3",
};
