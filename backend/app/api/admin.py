"""
ESG Lens — Admin API
All routes require role = admin.
Covers: moderation queue, approve/edit/reject, source CRUD, pipeline logs.
Source changes persist to both PostgreSQL and config.yaml at runtime.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

import yaml
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_config, BASE_DIR
from app.db.models import (
    FetchStrategy, PipelineRun, Policy, PolicyAlias,
    PolicyPillar, PolicyStatus, PolicyUrgency, ReviewStatus, Source, User
)
from app.db.session import get_db
from app.middleware.auth import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])
logger = logging.getLogger(__name__)
config = get_config()


# ══════════════════════════════════════════════════════════════
# Pydantic Schemas
# ══════════════════════════════════════════════════════════════

class PolicyAdminRow(BaseModel):
    id: int
    title: str
    source_name: Optional[str]
    source_url: str
    jurisdiction: Optional[str]
    pillar: Optional[str]
    sectors: List[str]
    status: Optional[str]
    urgency: Optional[str]
    summary: Optional[str]
    raw_text_excerpt: Optional[str]
    review_status: str
    created_at: datetime
    published_date: Optional[datetime]

    class Config:
        from_attributes = True


class ModerateRequest(BaseModel):
    action: str  # "approve" | "reject" | "edit_approve"
    rejection_note: Optional[str] = None
    # Editable fields for edit_approve
    title: Optional[str] = None
    pillar: Optional[str] = None
    sectors: Optional[List[str]] = None
    status: Optional[str] = None
    urgency: Optional[str] = None
    summary: Optional[str] = None
    jurisdiction: Optional[str] = None


class SourceCreate(BaseModel):
    name: str
    url: str
    source_type: Optional[str] = None
    fetch_strategy: str  # "rss" | "playwright"
    frequency_minutes: int = 60
    is_active: bool = True
    selector: Optional[str] = None
    jurisdiction: Optional[str] = None
    pillar_hint: Optional[str] = None


class SourceUpdate(BaseModel):
    name: Optional[str] = None
    url: Optional[str] = None
    source_type: Optional[str] = None
    fetch_strategy: Optional[str] = None
    frequency_minutes: Optional[int] = None
    is_active: Optional[bool] = None
    selector: Optional[str] = None
    jurisdiction: Optional[str] = None
    pillar_hint: Optional[str] = None


class SourceResponse(BaseModel):
    id: int
    name: str
    url: str
    source_type: Optional[str]
    fetch_strategy: str
    frequency_minutes: int
    is_active: bool
    last_checked_at: Optional[datetime]
    selector: Optional[str]
    jurisdiction: Optional[str]
    pillar_hint: Optional[str]

    class Config:
        from_attributes = True


class PipelineRunResponse(BaseModel):
    id: int
    triggered_at: datetime
    items_fetched: int
    items_after_dedup: int
    llm_calls_made: int
    errors: List[str]
    completed_at: Optional[datetime]
    duration_seconds: Optional[float]

    class Config:
        from_attributes = True


# ══════════════════════════════════════════════════════════════
# Moderation Queue
# ══════════════════════════════════════════════════════════════

@router.get("/queue", response_model=List[PolicyAdminRow])
async def get_moderation_queue(
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """All pending_review policies, newest first."""
    q = (
        select(Policy)
        .where(Policy.review_status == ReviewStatus.pending_review)
        .order_by(Policy.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    results = (await db.execute(q)).scalars().all()

    # Fetch source names
    source_ids = [p.source_id for p in results if p.source_id]
    sources_map = {}
    if source_ids:
        src_r = await db.execute(select(Source).where(Source.id.in_(source_ids)))
        sources_map = {s.id: s.name for s in src_r.scalars().all()}

    return [
        PolicyAdminRow(
            id=p.id,
            title=p.title,
            source_name=sources_map.get(p.source_id),
            source_url=p.source_url,
            jurisdiction=p.jurisdiction,
            pillar=p.pillar.value if p.pillar else None,
            sectors=p.sectors or [],
            status=p.status.value if p.status else None,
            urgency=p.urgency.value if p.urgency else None,
            summary=p.summary,
            raw_text_excerpt=(p.raw_text or "")[:500] if p.raw_text else None,
            review_status=p.review_status.value,
            created_at=p.created_at,
            published_date=p.published_date,
        )
        for p in results
    ]


@router.patch("/moderate/{policy_id}")
async def moderate_policy(
    policy_id: int,
    body: ModerateRequest,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """
    Approve, edit+approve, or reject a pending policy.
    On approval, triggers Agent 4 alert logic.
    """
    result = await db.execute(select(Policy).where(Policy.id == policy_id))
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(404, "Policy not found")

    if body.action in ("approve", "edit_approve"):
        # Apply edits if provided
        if body.action == "edit_approve":
            if body.title:
                policy.title = body.title
            if body.pillar:
                policy.pillar = PolicyPillar(body.pillar)
            if body.sectors is not None:
                policy.sectors = body.sectors
            if body.status:
                policy.status = PolicyStatus(body.status)
            if body.urgency:
                policy.urgency = PolicyUrgency(body.urgency)
            if body.summary:
                policy.summary = body.summary
            if body.jurisdiction:
                policy.jurisdiction = body.jurisdiction

        policy.review_status = ReviewStatus.verified
        policy.verified_by = admin.firebase_uid
        policy.verified_at = datetime.now(timezone.utc)

        db.add(policy)
        await db.flush()

        # Trigger Agent 4 alert logic asynchronously
        from app.agents.alert import trigger_alert_for_policy
        import asyncio
        asyncio.create_task(trigger_alert_for_policy(policy_id=policy.id))

        return {"status": "verified", "policy_id": policy_id}

    elif body.action == "reject":
        policy.review_status = ReviewStatus.rejected
        policy.rejection_note = body.rejection_note
        db.add(policy)

        # Remove from ChromaDB
        from app.services.chroma import delete_policy_embedding
        await delete_policy_embedding(policy_id)

        return {"status": "rejected", "policy_id": policy_id}

    else:
        raise HTTPException(400, f"Invalid action: {body.action}. Use approve, edit_approve, or reject.")


# ══════════════════════════════════════════════════════════════
# Source Management
# (Persists to PostgreSQL AND syncs config.yaml)
# ══════════════════════════════════════════════════════════════

def _sync_config_yaml(db_sources: List[Source]) -> None:
    """
    Writes active sources back to config.yaml.
    Called after any source create/update/delete.
    Ensures config.yaml stays in sync with PostgreSQL as the source of truth.
    """
    config_path = BASE_DIR / "config.yaml"
    with open(config_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)

    rss_sources = []
    playwright_sources = []

    for src in db_sources:
        entry = {
            "name": src.name,
            "url": src.url,
            "frequency_minutes": src.frequency_minutes,
            "is_active": src.is_active,
            "jurisdiction": src.jurisdiction or "",
            "pillar_hint": src.pillar_hint,
        }
        if src.fetch_strategy == FetchStrategy.playwright:
            entry["selector"] = src.selector or ""
            playwright_sources.append(entry)
        else:
            rss_sources.append(entry)

    data["sources"] = {
        "rss": rss_sources,
        "playwright": playwright_sources,
    }

    with open(config_path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, sort_keys=False, default_flow_style=False)

    # Hot-reload the in-memory config
    config.reload()
    logger.info("config.yaml synced from database sources")


@router.get("/sources", response_model=List[SourceResponse])
async def list_sources(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Returns all sources (active and inactive)."""
    result = await db.execute(select(Source).order_by(Source.fetch_strategy, Source.name))
    return result.scalars().all()


@router.post("/sources", response_model=SourceResponse, status_code=201)
async def create_source(
    body: SourceCreate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Creates a new source and syncs config.yaml."""
    # Check uniqueness
    existing = await db.execute(select(Source).where(Source.url == body.url))
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Source with this URL already exists")

    source = Source(
        name=body.name,
        url=body.url,
        source_type=body.source_type,
        fetch_strategy=FetchStrategy(body.fetch_strategy),
        frequency_minutes=body.frequency_minutes,
        is_active=body.is_active,
        selector=body.selector,
        jurisdiction=body.jurisdiction,
        pillar_hint=body.pillar_hint,
    )
    db.add(source)
    await db.flush()

    # Sync config.yaml
    all_sources_r = await db.execute(select(Source))
    _sync_config_yaml(all_sources_r.scalars().all())

    return source


@router.patch("/sources/{source_id}", response_model=SourceResponse)
async def update_source(
    source_id: int,
    body: SourceUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Updates any source field and syncs config.yaml."""
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Source not found")

    update_data = body.model_dump(exclude_none=True)
    for field, value in update_data.items():
        if field == "fetch_strategy":
            value = FetchStrategy(value)
        setattr(source, field, value)

    db.add(source)
    await db.flush()

    all_sources_r = await db.execute(select(Source))
    _sync_config_yaml(all_sources_r.scalars().all())

    return source


@router.delete("/sources/{source_id}", status_code=204)
async def delete_source(
    source_id: int,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Soft-deletes a source (sets is_active=False) and syncs config.yaml."""
    result = await db.execute(select(Source).where(Source.id == source_id))
    source = result.scalar_one_or_none()
    if not source:
        raise HTTPException(404, "Source not found")

    source.is_active = False
    db.add(source)
    await db.flush()

    all_sources_r = await db.execute(select(Source))
    _sync_config_yaml(all_sources_r.scalars().all())


# ══════════════════════════════════════════════════════════════
# Pipeline Logs
# ══════════════════════════════════════════════════════════════

@router.get("/logs", response_model=List[PipelineRunResponse])
async def get_pipeline_logs(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    """Returns the last 20 pipeline run records."""
    result = await db.execute(
        select(PipelineRun)
        .order_by(PipelineRun.triggered_at.desc())
        .limit(20)
    )
    runs = result.scalars().all()
    return [
        PipelineRunResponse(
            id=r.id,
            triggered_at=r.triggered_at,
            items_fetched=r.items_fetched,
            items_after_dedup=r.items_after_dedup,
            llm_calls_made=r.llm_calls_made,
            errors=r.errors or [],
            completed_at=r.completed_at,
            duration_seconds=r.duration_seconds,
        )
        for r in runs
    ]
