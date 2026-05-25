"""
ESG Lens — Agent 5: Digest Agent
Two phases:
  1. generate: queries verified policies from last 24h, creates personalised briefs per user
  2. dispatch: sends pending digest emails via Resend

Triggered by GitHub Actions cron:
  - generate: 7:30 PM IST daily
  - dispatch: 8:00 AM IST daily
"""

import logging
from datetime import datetime, timedelta, timezone
from typing import List

from sqlalchemy import and_, select

from app.config import get_config
from app.db.models import Digest, Policy, ReviewStatus, User
from app.db.session import db_context
from app.services.llm import generate_digest
from app.services.resend import dispatch_digest_email

logger = logging.getLogger(__name__)
config = get_config()


async def run_digest_generation() -> None:
    """
    Phase 1: Generate personalised digests for all users.
    Queries verified policies from last 24 hours.
    Per user: filters by sector_prefs + jurisdiction_prefs.
    Generates brief via Gemini and stores in digests table.
    """
    lookback_hours = config._data.get("digest", {}).get("lookback_hours", 24)
    cutoff = datetime.now(timezone.utc) - timedelta(hours=lookback_hours)

    async with db_context() as db:
        # Fetch verified policies from last 24h
        policies_result = await db.execute(
            select(Policy).where(
                and_(
                    Policy.review_status == ReviewStatus.verified,
                    Policy.verified_at >= cutoff,
                )
            ).order_by(Policy.urgency.desc(), Policy.verified_at.desc())
        )
        recent_policies = policies_result.scalars().all()

        if not recent_policies:
            logger.info("[Digest] No new verified policies in last 24h — skipping digest generation")
            return

        logger.info(f"[Digest] Found {len(recent_policies)} policies for digest")

        # Fetch all users with digest opt-in
        users_result = await db.execute(
            select(User).where(User.email_digest_opt_in == True)
        )
        users = users_result.scalars().all()

        logger.info(f"[Digest] Generating digests for {len(users)} opted-in users")

    for user in users:
        try:
            # Filter policies matching user preferences
            user_policies = _filter_policies_for_user(user, recent_policies)

            if not user_policies:
                logger.debug(f"[Digest] No matching policies for user {user.id} — skipping")
                continue

            # Generate personalised brief
            policies_data = [
                {
                    "title": p.title,
                    "pillar": p.pillar.value if p.pillar else "G",
                    "urgency": p.urgency.value if p.urgency else "Low",
                    "jurisdiction": p.jurisdiction or "Global",
                    "summary": p.summary or "",
                }
                for p in user_policies
            ]

            brief = await generate_digest(
                sectors=user.sector_prefs or [],
                jurisdictions=user.jurisdiction_prefs or [],
                policies=policies_data,
            )

            # Store digest
            async with db_context() as db:
                digest = Digest(
                    user_id=user.id,
                    content=brief,
                )
                db.add(digest)

            logger.info(f"[Digest] Generated digest for user {user.id} ({len(user_policies)} policies)")

        except Exception as e:
            logger.error(f"[Digest] Failed for user {user.id}: {e}")


async def run_digest_dispatch() -> None:
    """
    Phase 2: Dispatch pending digests via email (Resend).
    Sends only digests generated today that haven't been dispatched yet.
    """
    today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)

    async with db_context() as db:
        result = await db.execute(
            select(Digest)
            .where(
                and_(
                    Digest.generated_at >= today_start,
                    Digest.dispatched_at == None,
                )
            )
        )
        pending_digests = result.scalars().all()

        if not pending_digests:
            logger.info("[Digest Dispatch] No pending digests to send")
            return

        logger.info(f"[Digest Dispatch] Dispatching {len(pending_digests)} digests")

        for digest in pending_digests:
            # Fetch user
            user_result = await db.execute(select(User).where(User.id == digest.user_id))
            user = user_result.scalar_one_or_none()

            if not user or not user.email_digest_opt_in:
                continue

            success = await dispatch_digest_email(
                to_email=user.email,
                user_name=user.name,
                digest_content=digest.content,
                digest_id=digest.id,
            )

            if success:
                digest.dispatched_at = datetime.now(timezone.utc)
                db.add(digest)

    logger.info("[Digest Dispatch] Complete")


def _filter_policies_for_user(user: User, policies: List[Policy]) -> List[Policy]:
    """
    Filters policies for a user based on sector and jurisdiction preferences.
    Users with empty prefs receive all policies.
    """
    user_sectors = {s.lower() for s in (user.sector_prefs or [])}
    user_jurisdictions = {j.lower() for j in (user.jurisdiction_prefs or [])}

    if not user_sectors and not user_jurisdictions:
        return policies

    filtered = []
    for policy in policies:
        policy_sectors = {s.lower() for s in (policy.sectors or [])}
        policy_jurisdiction = (policy.jurisdiction or "").lower()

        sector_match = not user_sectors or bool(user_sectors & policy_sectors)
        jurisdiction_match = (
            not user_jurisdictions
            or policy_jurisdiction in user_jurisdictions
            or "global" in user_jurisdictions
        )

        if sector_match or jurisdiction_match:
            filtered.append(policy)

    return filtered
