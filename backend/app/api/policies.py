"""ESG Lens — Policies API (User-facing, editorially verified intelligence only)"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select, and_, func, case, cast, String, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_config
from app.db.models import (
    Policy, PolicyPillar, PolicyStatus, PolicyUrgency, ReviewStatus, Source,
)
from app.db.session import get_db
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/policies", tags=["policies"])
config = get_config()


# ── Display helpers (SustainableViews-style terminology) ─────

def _obligation_level(status: Optional[str], urgency: Optional[str]) -> str:
    if status == "Enacted" and urgency in ("High", "Critical"):
        return "Mandatory"
    if status == "Consultation":
        return "Advisory"
    return "Voluntary"


def _provision_subtype(source_type: Optional[str], status: Optional[str]) -> str:
    if source_type == "portal":
        return "Regulation"
    if source_type == "standard":
        return "Standard"
    if status in ("Proposed", "Amended"):
        return "Legislation"
    if source_type == "news":
        return "News & Analysis"
    return "Regulation"


def _display_status(status: Optional[str]) -> str:
    mapping = {
        "Enacted": "Current",
        "Amended": "Current",
        "Consultation": "Under Consultation",
        "Proposed": "Proposed",
    }
    return mapping.get(status or "", "In Review")


def _pillar_label(pillar: Optional[str]) -> Optional[str]:
    labels = {"E": "Environmental", "S": "Social", "G": "Governance"}
    return labels.get(pillar or "", pillar)


def _policy_to_response(p: Policy, source_name: Optional[str], source_type: Optional[str]) -> dict:
    status_val = p.status.value if p.status else None
    urgency_val = p.urgency.value if p.urgency else None
    pillar_val = p.pillar.value if p.pillar else None
    latest = p.published_date or p.created_at
    return {
        "id": p.id,
        "title": p.title,
        "source_name": source_name,
        "source_url": p.source_url,
        "jurisdiction": p.jurisdiction,
        "pillar": pillar_val,
        "applicability": _pillar_label(pillar_val),
        "sectors": p.sectors or [],
        "status": status_val,
        "display_status": _display_status(status_val),
        "urgency": urgency_val,
        "obligation": _obligation_level(status_val, urgency_val),
        "provision_subtype": _provision_subtype(source_type, status_val),
        "summary": p.summary,
        "published_date": p.published_date,
        "latest_update": latest,
        "created_at": p.created_at,
        "ai_verified": True,
    }


class PolicyCardResponse(BaseModel):
    id: int
    title: str
    source_name: Optional[str]
    source_url: str
    jurisdiction: Optional[str]
    pillar: Optional[str]
    applicability: Optional[str]
    sectors: List[str]
    status: Optional[str]
    display_status: str
    urgency: Optional[str]
    obligation: str
    provision_subtype: str
    summary: Optional[str]
    published_date: Optional[datetime]
    latest_update: datetime
    created_at: datetime
    ai_verified: bool = True


class PaginatedPolicies(BaseModel):
    items: List[PolicyCardResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


class MonitoringSource(BaseModel):
    id: int
    name: str
    url: str
    jurisdiction: Optional[str]
    source_type: Optional[str]
    fetch_strategy: str
    is_active: bool
    pillar_hint: Optional[str]


class TrackerMetaResponse(BaseModel):
    product_name: str
    tagline: str
    sectors: List[str]
    jurisdictions: List[str]
    applicability: List[dict]
    obligations: List[str]
    regulatory_statuses: List[str]
    provision_subtypes: List[str]
    sources: List[MonitoringSource]
    active_source_count: int


@router.get("/tracker-meta", response_model=TrackerMetaResponse)
async def get_tracker_meta(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Filter taxonomy + all configured monitoring sources for the Policy Tracker UI."""
    src_result = await db.execute(
        select(Source).order_by(Source.jurisdiction, Source.name)
    )
    sources = src_result.scalars().all()

    return TrackerMetaResponse(
        product_name="ESG Lens",
        tagline="Agentic ESG Policy Intelligence by Bevolve.ai",
        sectors=config.sectors,
        jurisdictions=config.jurisdictions,
        applicability=[
            {"value": "E", "label": "Environmental"},
            {"value": "S", "label": "Social"},
            {"value": "G", "label": "Governance"},
        ],
        obligations=["Mandatory", "Voluntary", "Advisory"],
        regulatory_statuses=["Proposed", "Consultation", "Enacted", "Amended"],
        provision_subtypes=["Regulation", "Legislation", "Standard", "Guidance", "News & Analysis"],
        sources=[
            MonitoringSource(
                id=s.id,
                name=s.name,
                url=s.url,
                jurisdiction=s.jurisdiction,
                source_type=s.source_type,
                fetch_strategy=s.fetch_strategy.value,
                is_active=s.is_active,
                pillar_hint=s.pillar_hint,
            )
            for s in sources
        ],
        active_source_count=sum(1 for s in sources if s.is_active),
    )


@router.get("", response_model=PaginatedPolicies)
async def list_policies(
    q: Optional[str] = Query(None, description="Full-text search query"),
    title_only: bool = Query(False),
    pillar: Optional[str] = Query(None, description="E, S, or G — applicability"),
    jurisdiction: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    source_id: Optional[int] = Query(None, description="Monitoring source / institution"),
    urgency: Optional[str] = Query(None),
    status: Optional[str] = Query(None, description="Regulatory status"),
    obligation: Optional[str] = Query(None, description="Mandatory | Voluntary | Advisory"),
    sort: str = Query("latest", description="latest | alphabetical | relevance | urgency"),
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Editorial intelligence feed — only policies with review_status = verified
    (passed Human-in-the-Loop editorial verification).
    """
    conditions = [Policy.review_status == ReviewStatus.verified]

    if pillar:
        conditions.append(Policy.pillar == PolicyPillar(pillar))
    if jurisdiction:
        conditions.append(Policy.jurisdiction.ilike(f"%{jurisdiction}%"))
    if urgency:
        conditions.append(Policy.urgency == PolicyUrgency(urgency))
    if status:
        conditions.append(Policy.status == PolicyStatus(status))
    if sector:
        conditions.append(cast(Policy.sectors, String).ilike(f"%{sector}%"))
    if source_id:
        conditions.append(Policy.source_id == source_id)

    if q:
        term = f"%{q.strip()}%"
        if title_only:
            conditions.append(Policy.title.ilike(term))
        else:
            conditions.append(
                or_(Policy.title.ilike(term), Policy.summary.ilike(term))
            )

    # Obligation filter (derived from status + urgency)
    if obligation == "Mandatory":
        conditions.append(Policy.status == PolicyStatus.Enacted)
        conditions.append(Policy.urgency.in_([PolicyUrgency.High, PolicyUrgency.Critical]))
    elif obligation == "Advisory":
        conditions.append(Policy.status == PolicyStatus.Consultation)
    elif obligation == "Voluntary":
        conditions.append(
            or_(
                Policy.status == PolicyStatus.Proposed,
                Policy.status == PolicyStatus.Amended,
            )
        )

    count_q = select(func.count()).select_from(Policy).where(and_(*conditions))
    total = (await db.execute(count_q)).scalar_one()

    if sort == "recent":
        sort = "latest"

    if sort == "alphabetical":
        order = (Policy.title.asc(),)
    elif sort == "relevance" and q:
        order = (Policy.title.asc(), Policy.created_at.desc())
    elif sort == "urgency":
        urgency_rank = case(
            (Policy.urgency == PolicyUrgency.Critical, 0),
            (Policy.urgency == PolicyUrgency.High, 1),
            (Policy.urgency == PolicyUrgency.Medium, 2),
            (Policy.urgency == PolicyUrgency.Low, 3),
            else_=4,
        )
        order = (urgency_rank, Policy.created_at.desc())
    else:
        order = (Policy.created_at.desc(),)

    q_stmt = (
        select(Policy)
        .where(and_(*conditions))
        .order_by(*order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    results = (await db.execute(q_stmt)).scalars().all()

    source_ids = [p.source_id for p in results if p.source_id]
    sources_map: dict = {}
    if source_ids:
        src_results = await db.execute(select(Source).where(Source.id.in_(source_ids)))
        for s in src_results.scalars().all():
            sources_map[s.id] = (s.name, s.source_type)

    items = []
    for p in results:
        src_info = sources_map.get(p.source_id, (None, None))
        items.append(PolicyCardResponse(**_policy_to_response(p, src_info[0], src_info[1])))

    return PaginatedPolicies(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
        has_next=(page * page_size) < total,
    )


@router.get("/{policy_id}", response_model=PolicyCardResponse)
async def get_policy(
    policy_id: int,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """Single verified policy record."""
    result = await db.execute(
        select(Policy).where(
            and_(Policy.id == policy_id, Policy.review_status == ReviewStatus.verified)
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        raise HTTPException(404, "Policy not found")

    source_name, source_type = None, None
    if policy.source_id:
        src = await db.execute(select(Source).where(Source.id == policy.source_id))
        src_obj = src.scalar_one_or_none()
        if src_obj:
            source_name, source_type = src_obj.name, src_obj.source_type

    return PolicyCardResponse(**_policy_to_response(policy, source_name, source_type))
