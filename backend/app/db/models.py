"""
ESG Lens — SQLAlchemy ORM Models
All 7 database tables with enums, indexes, and relationships.
"""

import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy import (
    BigInteger, Boolean, DateTime, Enum, ForeignKey,
    Index, Integer, String, Text, func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship
import enum


class Base(DeclarativeBase):
    pass


# ──────────────────────────────────────────────────────────────
# Enums
# ──────────────────────────────────────────────────────────────

class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class ReviewStatus(str, enum.Enum):
    pending_review = "pending_review"
    verified = "verified"
    rejected = "rejected"


class PolicyPillar(str, enum.Enum):
    E = "E"
    S = "S"
    G = "G"


class PolicyUrgency(str, enum.Enum):
    Low = "Low"
    Medium = "Medium"
    High = "High"
    Critical = "Critical"


class PolicyStatus(str, enum.Enum):
    Proposed = "Proposed"
    Consultation = "Consultation"
    Enacted = "Enacted"
    Amended = "Amended"


class FetchStrategy(str, enum.Enum):
    rss = "rss"
    playwright = "playwright"


# ──────────────────────────────────────────────────────────────
# Users
# ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    firebase_uid: Mapped[str] = mapped_column(String(128), unique=True, nullable=False, index=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole, name="user_role"), default=UserRole.user, nullable=False
    )
    sector_prefs: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    jurisdiction_prefs: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    email_digest_opt_in: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    digests: Mapped[List["Digest"]] = relationship("Digest", back_populates="user")


# ──────────────────────────────────────────────────────────────
# Sources
# ──────────────────────────────────────────────────────────────

class Source(Base):
    __tablename__ = "sources"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False, unique=True)
    source_type: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)  # e.g., "portal", "news", "standard"
    fetch_strategy: Mapped[FetchStrategy] = mapped_column(
        Enum(FetchStrategy, name="fetch_strategy"), nullable=False
    )
    frequency_minutes: Mapped[int] = mapped_column(Integer, default=60, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    last_checked_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    # Playwright-specific
    selector: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    jurisdiction: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    pillar_hint: Mapped[Optional[str]] = mapped_column(String(4), nullable=True)

    policies: Mapped[List["Policy"]] = relationship("Policy", back_populates="source")


# ──────────────────────────────────────────────────────────────
# Policies
# ──────────────────────────────────────────────────────────────

class Policy(Base):
    __tablename__ = "policies"
    __table_args__ = (
        Index("ix_policies_review_status", "review_status"),
        Index("ix_policies_pillar", "pillar"),
        Index("ix_policies_urgency", "urgency"),
        Index("ix_policies_jurisdiction", "jurisdiction"),
        Index("ix_policies_created_at", "created_at"),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    source_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("sources.id", ondelete="SET NULL"), nullable=True
    )
    source_url: Mapped[str] = mapped_column(Text, nullable=False)
    raw_text: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    jurisdiction: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    pillar: Mapped[Optional[PolicyPillar]] = mapped_column(
        Enum(PolicyPillar, name="policy_pillar"), nullable=True
    )
    sectors: Mapped[List[str]] = mapped_column(ARRAY(String), default=list, nullable=False)
    status: Mapped[Optional[PolicyStatus]] = mapped_column(
        Enum(PolicyStatus, name="policy_status"), nullable=True
    )
    urgency: Mapped[Optional[PolicyUrgency]] = mapped_column(
        Enum(PolicyUrgency, name="policy_urgency"), nullable=True
    )
    summary: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    review_status: Mapped[ReviewStatus] = mapped_column(
        Enum(ReviewStatus, name="review_status"),
        default=ReviewStatus.pending_review,
        nullable=False,
    )
    verified_by: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)  # admin firebase_uid
    verified_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)
    rejection_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    master_policy_id: Mapped[Optional[int]] = mapped_column(
        BigInteger, ForeignKey("policies.id", ondelete="SET NULL"), nullable=True
    )
    chroma_id: Mapped[Optional[str]] = mapped_column(String(128), nullable=True)

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    published_date: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    source: Mapped[Optional["Source"]] = relationship("Source", back_populates="policies")
    aliases: Mapped[List["PolicyAlias"]] = relationship("PolicyAlias", back_populates="master_policy")


# ──────────────────────────────────────────────────────────────
# Policy Aliases
# ──────────────────────────────────────────────────────────────

class PolicyAlias(Base):
    __tablename__ = "policy_aliases"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    alias_text: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    master_policy_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("policies.id", ondelete="CASCADE"), nullable=False
    )

    master_policy: Mapped["Policy"] = relationship("Policy", back_populates="aliases")


# ──────────────────────────────────────────────────────────────
# Seen Hashes (Deduplication)
# ──────────────────────────────────────────────────────────────

class SeenHash(Base):
    __tablename__ = "seen_hashes"
    __table_args__ = (
        Index("ix_seen_hashes_url_hash", "url_hash", unique=True),
    )

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    url_hash: Mapped[str] = mapped_column(String(64), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )


# ──────────────────────────────────────────────────────────────
# Digests
# ──────────────────────────────────────────────────────────────

class Digest(Base):
    __tablename__ = "digests"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int] = mapped_column(
        BigInteger, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    content: Mapped[str] = mapped_column(Text, nullable=False)
    generated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    dispatched_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    user: Mapped["User"] = relationship("User", back_populates="digests")


# ──────────────────────────────────────────────────────────────
# Pipeline Runs
# ──────────────────────────────────────────────────────────────

class PipelineRun(Base):
    __tablename__ = "pipeline_runs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    triggered_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    items_fetched: Mapped[int] = mapped_column(Integer, default=0)
    items_after_dedup: Mapped[int] = mapped_column(Integer, default=0)
    llm_calls_made: Mapped[int] = mapped_column(Integer, default=0)
    errors: Mapped[List[str]] = mapped_column(ARRAY(Text), default=list, nullable=False)
    completed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    @property
    def duration_seconds(self) -> Optional[float]:
        if self.completed_at and self.triggered_at:
            return (self.completed_at - self.triggered_at).total_seconds()
        return None
