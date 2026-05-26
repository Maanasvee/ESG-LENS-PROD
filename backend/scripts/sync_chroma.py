"""
Sync verified policies from database to ChromaDB (run from backend/).
  python scripts/sync_chroma.py
"""

import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select
from app.db.models import Policy, ReviewStatus
from app.db.session import db_context
from app.services.llm import generate_embedding
from app.services.chroma import store_policy_embedding


async def main():
    print("Starting ChromaDB policy index synchronization...")
    async with db_context() as db:
        result = await db.execute(
            select(Policy).where(Policy.review_status == ReviewStatus.verified)
        )
        policies = result.scalars().all()

        print(f"Found {len(policies)} verified policies in database.")

        for p in policies:
            text_to_embed = f"{p.title}\n{p.summary or ''}"
            print(f"Indexing policy {p.id}: '{p.title[:50]}...'")
            
            # Generate embedding (will gracefully fallback to mock vector in dev if needed)
            embedding = await generate_embedding(text_to_embed)
            
            await store_policy_embedding(
                policy_id=p.id,
                text=text_to_embed,
                embedding=embedding,
                metadata={
                    "pillar": p.pillar.value if p.pillar else "",
                    "jurisdiction": p.jurisdiction or "",
                    "urgency": p.urgency.value if p.urgency else "",
                }
            )
        
        print("ChromaDB index synchronization complete!")


if __name__ == "__main__":
    asyncio.run(main())
