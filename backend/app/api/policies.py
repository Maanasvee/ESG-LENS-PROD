"""ESG Lens — Policies API (User-facing, verified only)"""

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
from sqlalchemy import select, and_, or_, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Policy, PolicyPillar, PolicyUrgency, PolicyStatus, ReviewStatus, Source
from app.db.session import get_db
from app.middleware.auth import get_current_user

router = APIRouter(prefix="/api/policies", tags=["policies"])


class PolicyCardResponse(BaseModel):
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
    published_date: Optional[datetime]
    created_at: datetime

    class Config:
        from_attributes = True


class PaginatedPolicies(BaseModel):
    items: List[PolicyCardResponse]
    total: int
    page: int
    page_size: int
    has_next: bool


@router.get("", response_model=PaginatedPolicies)
async def list_policies(
    # Filters
    pillar: Optional[str] = Query(None, description="E, S, or G"),
    jurisdiction: Optional[str] = Query(None),
    sector: Optional[str] = Query(None),
    urgency: Optional[str] = Query(None, description="Low, Medium, High, Critical"),
    status: Optional[str] = Query(None, description="Proposed, Consultation, Enacted, Amended"),
    # Sort
    sort: str = Query("recent", description="recent | urgency"),
    # Pagination
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Returns paginated verified policies with optional filters.
    Users only see review_status = 'verified'.
    """
    conditions = [Policy.review_status == ReviewStatus.verified]

    if pillar:
        conditions.append(Policy.pillar == pillar)
    if jurisdiction:
        conditions.append(Policy.jurisdiction.ilike(f"%{jurisdiction}%"))
    if urgency:
        conditions.append(Policy.urgency == urgency)
    if status:
        conditions.append(Policy.status == status)
    if sector:
        conditions.append(Policy.sectors.contains([sector]))

    # Count total
    count_q = select(func.count()).select_from(Policy).where(and_(*conditions))
    total = (await db.execute(count_q)).scalar_one()

    # Sort
    if sort == "urgency":
        urgency_order = {
            PolicyUrgency.Critical: 0,
            PolicyUrgency.High: 1,
            PolicyUrgency.Medium: 2,
            PolicyUrgency.Low: 3,
        }
        order_col = Policy.created_at.desc()  # Secondary sort
        q = (
            select(Policy)
            .where(and_(*conditions))
            .order_by(
                func.array_position(
                    ["Critical", "High", "Medium", "Low"],
                    Policy.urgency.cast(str),
                ),
                Policy.created_at.desc(),
            )
        )
    else:
        q = select(Policy).where(and_(*conditions)).order_by(Policy.created_at.desc())

    # Paginate
    q = q.offset((page - 1) * page_size).limit(page_size)
    results = (await db.execute(q)).scalars().all()

    # Fetch source names in one query
    source_ids = [p.source_id for p in results if p.source_id]
    sources_map = {}
    if source_ids:
        src_results = await db.execute(select(Source).where(Source.id.in_(source_ids)))
        sources_map = {s.id: s.name for s in src_results.scalars().all()}

    items = []
    for p in results:
        items.append(PolicyCardResponse(
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
            published_date=p.published_date,
            created_at=p.created_at,
        ))

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
    """Returns a single verified policy by ID."""
    result = await db.execute(
        select(Policy).where(
            and_(Policy.id == policy_id, Policy.review_status == ReviewStatus.verified)
        )
    )
    policy = result.scalar_one_or_none()
    if not policy:
        from fastapi import HTTPException
        raise HTTPException(404, "Policy not found")

    source_name = None
    if policy.source_id:
        src = await db.execute(select(Source).where(Source.id == policy.source_id))
        src_obj = src.scalar_one_or_none()
        source_name = src_obj.name if src_obj else None

    return PolicyCardResponse(
        id=policy.id,
        title=policy.title,
        source_name=source_name,
        source_url=policy.source_url,
        jurisdiction=policy.jurisdiction,
        pillar=policy.pillar.value if policy.pillar else None,
        sectors=policy.sectors or [],
        status=policy.status.value if policy.status else None,
        urgency=policy.urgency.value if policy.urgency else None,
        summary=policy.summary,
        published_date=policy.published_date,
        created_at=policy.created_at,
    )
