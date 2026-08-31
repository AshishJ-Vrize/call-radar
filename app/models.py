"""ORM models. Single-tenant; mirrors the Alembic 0001 migration exactly."""
from __future__ import annotations

from datetime import datetime

from sqlalchemy import (
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


class Agent(Base):
    __tablename__ = "agents"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Customer(Base):
    __tablename__ = "customers"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())


class Call(Base):
    __tablename__ = "calls"
    id: Mapped[str] = mapped_column(String(32), primary_key=True)  # = sid
    customer_id: Mapped[int] = mapped_column(ForeignKey("customers.id"), index=True)
    agent_id: Mapped[int] = mapped_column(ForeignKey("agents.id"), index=True)
    session: Mapped[str | None] = mapped_column(String(120))
    started_at: Mapped[datetime | None] = mapped_column(index=True)
    ended_at: Mapped[datetime | None]
    duration_s: Mapped[int | None] = mapped_column(Integer)
    caller_mos: Mapped[float | None] = mapped_column(Numeric(3, 1))
    agent_mos: Mapped[float | None] = mapped_column(Numeric(3, 1))
    transcript_status: Mapped[str] = mapped_column(String(16), default="pending")
    analysis_status: Mapped[str] = mapped_column(String(16), default="pending")
    created_at: Mapped[datetime] = mapped_column(server_default=func.now())

    customer: Mapped[Customer] = relationship()
    agent: Mapped[Agent] = relationship()
    turns: Mapped[list["TranscriptTurn"]] = relationship(
        back_populates="call", cascade="all, delete-orphan", order_by="TranscriptTurn.idx"
    )
    analysis: Mapped["CallAnalysis | None"] = relationship(
        back_populates="call", uselist=False, cascade="all, delete-orphan"
    )


class TranscriptTurn(Base):
    __tablename__ = "transcript_turns"
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    call_id: Mapped[str] = mapped_column(ForeignKey("calls.id", ondelete="CASCADE"), index=True)
    idx: Mapped[int] = mapped_column(Integer, nullable=False)
    speaker: Mapped[str] = mapped_column(String(16), nullable=False)  # agent | customer
    start_s: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    end_s: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)

    call: Mapped[Call] = relationship(back_populates="turns")
    __table_args__ = (UniqueConstraint("call_id", "idx", name="uq_turn_call_idx"),)


class CallAnalysis(Base):
    __tablename__ = "call_analysis"
    call_id: Mapped[str] = mapped_column(
        ForeignKey("calls.id", ondelete="CASCADE"), primary_key=True
    )
    intent: Mapped[str | None] = mapped_column(Text)
    intent_evidence: Mapped[dict | None] = mapped_column(JSONB)
    mood_timeline: Mapped[list | None] = mapped_column(JSONB)
    mood_shift: Mapped[dict | None] = mapped_column(JSONB)
    resolution: Mapped[str | None] = mapped_column(String(24))
    resolution_evidence: Mapped[dict | None] = mapped_column(JSONB)
    summary: Mapped[str | None] = mapped_column(Text)
    needs_attention_score: Mapped[int | None] = mapped_column(Integer, index=True)
    score_breakdown: Mapped[dict | None] = mapped_column(JSONB)
    trending_issue_label: Mapped[str | None] = mapped_column(String(80), index=True)
    model: Mapped[str | None] = mapped_column(String(60))
    prompt_version: Mapped[int | None] = mapped_column(Integer)
    analyzed_at: Mapped[datetime | None] = mapped_column(server_default=func.now())

    call: Mapped[Call] = relationship(back_populates="analysis")


Index("ix_call_analysis_score_desc", CallAnalysis.needs_attention_score.desc())
