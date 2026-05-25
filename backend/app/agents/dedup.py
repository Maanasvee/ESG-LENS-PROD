"""
ESG Lens — Agent 2: Dedup
SHA-256 URL deduplication against PostgreSQL seen_hashes table.
Batch queries + batch inserts for efficiency.
Reduces ~300 raw daily items to 5–20 genuinely new ones.
"""

import hashlib
import logging
from typing import List

from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.db.models import SeenHash
from app.db.session import db_context

logger = logging.getLogger(__name__)


def _url_hash(url: str) -> str:
    """SHA-256 hash of a URL, hex-encoded."""
    return hashlib.sha256(url.encode("utf-8")).hexdigest()


async def run_dedup(raw_items: List[dict]) -> List[dict]:
    """
    Filters out items whose URL hash already exists in seen_hashes.
    Inserts new hashes immediately for this batch.
    Returns only genuinely new items.
    """
    if not raw_items:
        return []

    # Build hash map for this batch
    items_with_hashes = [
        (item, _url_hash(item["url"])) for item in raw_items if item.get("url")
    ]

    all_hashes = [h for _, h in items_with_hashes]

    async with db_context() as db:
        # Bulk check existing hashes
        result = await db.execute(
            select(SeenHash.url_hash).where(SeenHash.url_hash.in_(all_hashes))
        )
        existing_hashes = set(result.scalars().all())

        # Filter to new only
        new_items = []
        new_hashes = []
        for item, h in items_with_hashes:
            if h not in existing_hashes:
                new_items.append(item)
                new_hashes.append(h)
                existing_hashes.add(h)  # Prevent intra-batch duplicates

        # Batch insert new hashes
        if new_hashes:
            await db.execute(
                pg_insert(SeenHash)
                .values([{"url_hash": h} for h in new_hashes])
                .on_conflict_do_nothing(index_elements=["url_hash"])
            )

    logger.info(
        f"[Dedup] {len(raw_items)} raw → {len(new_items)} new "
        f"({len(raw_items) - len(new_items)} duplicates dropped)"
    )
    return new_items
