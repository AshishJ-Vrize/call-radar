const j = (u) => fetch(u).then((r) => {
  if (!r.ok) throw new Error(`${r.status} ${u}`);
  return r.json();
});

export const api = {
  meta: () => j("/api/dashboard/meta"),
  attention: (date, limit = 30) =>
    j(`/api/dashboard/attention?limit=${limit}${date ? `&date=${date}` : ""}`),
  trends: (date, window = 7) =>
    j(`/api/dashboard/trends?window=${window}${date ? `&date=${date}` : ""}`),
  agents: () => j("/api/dashboard/agents"),
  customers: () => j("/api/customers"),
  customer: (id) => j(`/api/customers/${id}`),
  call: (sid) => j(`/api/calls/${sid}`),
  audioUrl: (sid) => `/api/calls/${sid}/audio`,
};

export const fmtDur = (s) =>
  s == null ? "–" : `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
export const fmtDate = (iso) => (iso ? new Date(iso).toLocaleString() : "–");
export const fmtDay = (iso) => (iso ? new Date(iso).toLocaleDateString() : "–");

export const MOOD_COLOR = {
  positive: "#22c55e", relieved: "#4ade80", neutral: "#64748b",
  anxious: "#eab308", frustrated: "#f97316", angry: "#ef4444",
};
export const RES_COLOR = {
  resolved: "bg-emerald-600", follow_up_promised: "bg-amber-600",
  unresolved: "bg-red-600", unclear: "bg-slate-600",
};
export const scoreColor = (n) =>
  n >= 60 ? "#ef4444" : n >= 30 ? "#f97316" : n >= 10 ? "#eab308" : "#22c55e";
