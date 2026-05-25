"""
ESG Lens — DB Writer (between Agent 3.5 and Agent 4)
Inserts classified policies into PostgreSQL with review_status=pending_review.
Generates text embeddings and stores in ChromaDB.
Sends FCM to admin-notifications topic.
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional

from sqlalchemy import select

from app.db.models import Policy, PolicyPillar, PolicyStatus, PolicyUrgency, ReviewStatus, Source
from app.db.session import db_context
from app.services.chroma import store_policy_embedding
from app.services.llm import generate_embedding
from app.services.firebase_admin import send_fcm_notification

logger = logging.getLogger(__name__)


async def run_db_write(normalised_items: List[dict]) -> List[int]:
    """
    Inserts new policies and stores their embeddings.
    Items with master_policy_id are linked but not inserted as new records.
    Returns list of newly inserted policy IDs.
    """
    inserted_ids = []

    for item in normalised_items:
        # Skip alias-linked items (already have a master record)
        if item.get("master_policy_id"):
            logger.debug(f"[DBWrite] Skipping alias-linked: {item.get('title')}")
            continue

        try:
            async with db_context() as db:
                # Look up source_id
                source_id = item.get("source_id")

                # Parse published_date
                pub_date = None
                if item.get("date"):
                    try:
                        pub_date = datetime.strptime(item["date"], "%Y-%m-%d").replace(tzinfo=timezone.utc)
                    except ValueError:
                        pass

                policy = Policy(
                    title=item.get("title", "Untitled"),
                    source_id=source_id,
                    source_url=item.get("source_url", ""),
                    raw_text=item.get("raw_text", "")[:50000],
                    jurisdiction=item.get("jurisdiction"),
                    pillar=_safe_enum(PolicyPillar, item.get("pillar")),
                    sectors=item.get("sectors", []),
                    status=_safe_enum(PolicyStatus, item.get("status")),
                    urgency=_safe_enum(PolicyUrgency, item.get("urgency")),
                    summary=item.get("summary"),
                    review_status=ReviewStatus.pending_review,
                    published_date=pub_date,
                )

                db.add(policy)
                await db.flush()
                policy_id = policy.id
                inserted_ids.append(policy_id)

            # Generate and store embedding (outside main transaction for perf)
            embed_text = f"{item.get('title', '')} {item.get('summary', '')} {item.get('jurisdiction', '')}"
            try:
                embedding = await generate_embedding(embed_text)
                chroma_id = await store_policy_embedding(
                    policy_id=policy_id,
                    text=embed_text,
                    embedding=embedding,
                    metadata={
                        "pillar": item.get("pillar", ""),
                        "jurisdiction": item.get("jurisdiction", ""),
                        "urgency": item.get("urgency", ""),
                    },
                )
                # Update chroma_id on policy
                async with db_context() as db:
                    result = await db.execute(select(Policy).where(Policy.id == policy_id))
                    pol = result.scalar_one()
                    pol.chroma_id = chroma_id
                    db.add(pol)

            except Exception as e:
                logger.warning(f"[DBWrite] Embedding failed for policy {policy_id}: {e}")

            logger.info(f"[DBWrite] Inserted policy #{policy_id}: {item.get('title', '')[:60]}")

        except Exception as e:
            logger.error(f"[DBWrite] Failed to insert '{item.get('title', '')}': {e}")

    # Send admin FCM notification
    if inserted_ids:
        count = len(inserted_ids)
        try:
            import firebase_admin
            from firebase_admin import messaging
            from app.services.firebase_admin import _init_firebase
            _init_firebase()
            topic_msg = messaging.Message(
                notification=messaging.Notification(
                    title="ESG Lens — New Policies Pending Review",
                    body=f"{count} new {'policy' if count == 1 else 'policies'} added to moderation queue",
                ),
                data={"count": str(count), "type": "pending_review"},
                topic="admin-notifications",
            )
            messaging.send(topic_msg)
        except Exception as e:
            logger.warning(f"[DBWrite] Admin FCM notification failed: {e}")

    logger.info(f"[DBWrite] Total inserted: {len(inserted_ids)} policies")
    return inserted_ids


def _safe_enum(enum_cls, value: Optional[str]):
    """Safely convert string to enum value, returning None on failure."""
    if value is None:
        return None
    try:
        return enum_cls(value)
    except ValueError:
        return None
