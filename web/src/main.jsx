import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  BrowserRouter, Routes, Route, NavLink, Navigate, useLocation,
} from "react-router-dom";
import { api } from "./api.js";
import Attention from "./pages/Attention.jsx";
import Agents from "./pages/Agents.jsx";
import Customers from "./pages/Customers.jsx";
import CustomerDetail from "./pages/CustomerDetail.jsx";
import CallDetail from "./pages/CallDetail.jsx";

const SECTIONS = [
  ["/attention", "Watch List"],
  ["/customers", "Customers"],
  ["/agents", "Agents"],
];

function Chrome({ children }) {
  const [meta, setMeta] = useState(null);
  const loc = useLocation();
  useEffect(() => { api.meta().then(setMeta).catch(() => {}); }, []);

  const section =
    SECTIONS.find(([p]) => loc.pathname.startsWith(p))?.[1] ||
    (loc.pathname.startsWith("/calls") ? "Call File" : "");

  return (
    <div className="min-h-screen">
      {/* instrument bar */}
      <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur-sm border-b border-hair-2">
        <div className="max-w-[1240px] mx-auto px-6 h-12 flex items-center gap-6">
          <NavLink to="/attention" className="flex items-center gap-2 group">
            <span className="w-1.5 h-1.5 bg-cyan live-dot" />
            <span className="font-mono text-[12px] tracking-[0.22em] uppercase text-ink group-hover:text-cyan">
              Call·Centre Radar
            </span>
          </NavLink>
          <nav className="flex items-center gap-5">
            {SECTIONS.map(([path, label]) => (
              <NavLink key={path} to={path}
                className={({ isActive }) =>
                  `text-[13px] pb-0.5 border-b transition-colors ${
                    isActive
                      ? "text-ink border-ink"
                      : "text-ink-3 border-transparent hover:text-ink-2"
                  }`
                }>
                {label}
              </NavLink>
            ))}
          </nav>
          <div className="ml-auto font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3 tnum">
            {meta
              ? `DATASET ${meta.default_date ?? "—"} · ${meta.analyzed_calls}/${meta.total_calls} CALLS`
              : "···"}
          </div>
        </div>
      </header>

      {/* left section rail */}
      <div className="max-w-[1240px] mx-auto relative">
        <div className="hidden lg:block absolute -left-2 top-6 h-full">
          <div className="sticky top-24 origin-top-left -rotate-90 -translate-x-full whitespace-nowrap u-label text-ink-2">
            {section} <span className="text-hair-2">/ / /</span>
          </div>
        </div>
        <main className="px-6 py-8">{children}</main>
      </div>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Chrome>
      <Routes>
        <Route path="/" element={<Navigate to="/attention" replace />} />
        <Route path="/attention" element={<Attention />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/calls/:sid" element={<CallDetail />} />
      </Routes>
    </Chrome>
  </BrowserRouter>
);
