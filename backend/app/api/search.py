"""ESG Lens — Semantic Search API"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy import select, and_
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import Policy, ReviewStatus
from app.db.session import get_db
from app.middleware.auth import get_current_user
from app.services.llm import generate_query_embedding
from app.services.chroma import search_policies

router = APIRouter(prefix="/api/search", tags=["search"])


class SearchRequest(BaseModel):
    query: str
    n_results: int = 10


class SearchResult(BaseModel):
    policy_id: int
    title: str
    summary: Optional[str]
    jurisdiction: Optional[str]
    pillar: Optional[str]
    urgency: Optional[str]
    similarity: float
    source_url: str


@router.post("", response_model=List[SearchResult])
async def semantic_search(
    body: SearchRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    """
    Natural language semantic search over verified policies.
    Uses Gemini text-embedding-004 + ChromaDB cosine similarity.
    """
    if not body.query.strip():
        raise HTTPException(400, "Query cannot be empty")

    # Generate query embedding
    query_embedding = await generate_query_embedding(body.query)

    # Search ChromaDB
    hits = await search_policies(
        query_embedding=query_embedding,
        n_results=body.n_results,
    )

    if not hits:
        return []

    # Fetch full policy records from PostgreSQL
    policy_ids = [h["policy_id"] for h in hits if h["policy_id"]]
    policies_result = await db.execute(
        select(Policy).where(
            and_(
                Policy.id.in_(policy_ids),
                Policy.review_status == ReviewStatus.verified,
            )
        )
    )
    policies_map = {p.id: p for p in policies_result.scalars().all()}

    # Build response sorted by similarity
    results = []
    for hit in sorted(hits, key=lambda x: x["similarity"], reverse=True):
        pid = hit["policy_id"]
        policy = policies_map.get(pid)
        if policy:
            results.append(SearchResult(
                policy_id=pid,
                title=policy.title,
                summary=policy.summary,
                jurisdiction=policy.jurisdiction,
                pillar=policy.pillar.value if policy.pillar else None,
                urgency=policy.urgency.value if policy.urgency else None,
                similarity=round(hit["similarity"], 4),
                source_url=policy.source_url,
            ))

    return results
