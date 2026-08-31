"""initial schema

Revision ID: 0001
Revises:
Create Date: 2026-08-31
"""
from __future__ import annotations

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = "0001"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "agents",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(120), nullable=False, unique=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_table(
        "customers",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("name", sa.String(200), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_customers_name", "customers", ["name"])

    op.create_table(
        "calls",
        sa.Column("id", sa.String(32), primary_key=True),
        sa.Column("customer_id", sa.Integer, sa.ForeignKey("customers.id"), nullable=False),
        sa.Column("agent_id", sa.Integer, sa.ForeignKey("agents.id"), nullable=False),
        sa.Column("session", sa.String(120)),
        sa.Column("started_at", sa.DateTime(timezone=True)),
        sa.Column("ended_at", sa.DateTime(timezone=True)),
        sa.Column("duration_s", sa.Integer),
        sa.Column("caller_mos", sa.Numeric(3, 1)),
        sa.Column("agent_mos", sa.Numeric(3, 1)),
        sa.Column("transcript_status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("analysis_status", sa.String(16), nullable=False, server_default="pending"),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_calls_customer_id", "calls", ["customer_id"])
    op.create_index("ix_calls_agent_id", "calls", ["agent_id"])
    op.create_index("ix_calls_started_at", "calls", ["started_at"])

    op.create_table(
        "transcript_turns",
        sa.Column("id", sa.Integer, primary_key=True),
        sa.Column("call_id", sa.String(32), sa.ForeignKey("calls.id", ondelete="CASCADE"), nullable=False),
        sa.Column("idx", sa.Integer, nullable=False),
        sa.Column("speaker", sa.String(16), nullable=False),
        sa.Column("start_s", sa.Numeric(8, 2), nullable=False),
        sa.Column("end_s", sa.Numeric(8, 2), nullable=False),
        sa.Column("text", sa.Text, nullable=False),
        sa.UniqueConstraint("call_id", "idx", name="uq_turn_call_idx"),
    )
    op.create_index("ix_transcript_turns_call_id", "transcript_turns", ["call_id"])

    op.create_table(
        "call_analysis",
        sa.Column("call_id", sa.String(32), sa.ForeignKey("calls.id", ondelete="CASCADE"), primary_key=True),
        sa.Column("intent", sa.Text),
        sa.Column("intent_evidence", JSONB),
        sa.Column("mood_timeline", JSONB),
        sa.Column("mood_shift", JSONB),
        sa.Column("resolution", sa.String(24)),
        sa.Column("resolution_evidence", JSONB),
        sa.Column("summary", sa.Text),
        sa.Column("needs_attention_score", sa.Integer),
        sa.Column("score_breakdown", JSONB),
        sa.Column("trending_issue_label", sa.String(80)),
        sa.Column("model", sa.String(60)),
        sa.Column("prompt_version", sa.Integer),
        sa.Column("analyzed_at", sa.DateTime(timezone=True), server_default=sa.func.now()),
    )
    op.create_index("ix_call_analysis_score", "call_analysis", ["needs_attention_score"])
    op.create_index("ix_call_analysis_issue", "call_analysis", ["trending_issue_label"])


def downgrade() -> None:
    op.drop_table("call_analysis")
    op.drop_table("transcript_turns")
    op.drop_table("calls")
    op.drop_index("ix_customers_name", table_name="customers")
    op.drop_table("customers")
    op.drop_table("agents")
