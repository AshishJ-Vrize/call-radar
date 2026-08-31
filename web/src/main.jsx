import React from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, NavLink, Navigate } from "react-router-dom";
import Attention from "./pages/Attention.jsx";
import Agents from "./pages/Agents.jsx";
import Customers from "./pages/Customers.jsx";
import CustomerDetail from "./pages/CustomerDetail.jsx";
import CallDetail from "./pages/CallDetail.jsx";

function Shell({ children }) {
  const link = ({ isActive }) =>
    `px-3 py-1.5 rounded-md text-sm font-medium ${
      isActive ? "bg-indigo-600 text-white" : "text-slate-300 hover:bg-slate-800"
    }`;
  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-800 bg-slate-950/60 sticky top-0 z-10 backdrop-blur">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center gap-4">
          <span className="text-lg font-bold tracking-tight">
            📡 Call-Centre <span className="text-indigo-400">Radar</span>
          </span>
          <nav className="flex gap-1 ml-4">
            <NavLink to="/attention" className={link}>Needs Attention</NavLink>
            <NavLink to="/agents" className={link}>Agents</NavLink>
            <NavLink to="/customers" className={link}>Customers</NavLink>
          </nav>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-5 py-6">{children}</main>
    </div>
  );
}

createRoot(document.getElementById("root")).render(
  <BrowserRouter>
    <Shell>
      <Routes>
        <Route path="/" element={<Navigate to="/attention" replace />} />
        <Route path="/attention" element={<Attention />} />
        <Route path="/agents" element={<Agents />} />
        <Route path="/customers" element={<Customers />} />
        <Route path="/customers/:id" element={<CustomerDetail />} />
        <Route path="/calls/:sid" element={<CallDetail />} />
      </Routes>
    </Shell>
  </BrowserRouter>
);
