"""Call-Centre Radar API. Reads only cached analysis — never transcribes on request."""
from __future__ import annotations

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api import routes_calls, routes_customers, routes_dashboard

app = FastAPI(title="Call-Centre Radar API", version="1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(routes_customers.router)
app.include_router(routes_calls.router)
app.include_router(routes_dashboard.router)


@app.get("/api/health")
def health() -> dict:
    return {"ok": True}
