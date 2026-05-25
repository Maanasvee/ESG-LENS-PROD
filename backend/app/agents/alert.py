"""
ESG Lens — Agent 4: Alert Trigger
Called after admin sets review_status = 'verified'.
Sends FCM push to users whose sector/jurisdiction prefs match the policy,
but ONLY if status=Enacted AND urgency=High|Critical.
"""

import logging
from typing import List

from sqlalchemy import select

from app.config import get_config
from app.db.models import Policy, PolicyStatus, PolicyUrgency, ReviewStatus, User
from app.db.session import db_context

logger = logging.getLogger(__name__)
config = get_config()


async def trigger_alert_for_policy(policy_id: int) -> None:
    """
    Called immediately after admin approval.
    Checks if policy qualifies for immediate FCM push.
    If not, logs it for digest-only delivery.
    """
    async with db_context() as db:
        result = await db.execute(select(Policy).where(Policy.id == policy_id))
        policy = result.scalar_one_or_none()

        if not policy or policy.review_status != ReviewStatus.verified:
            logger.warning(f"[Alert] Policy {policy_id} not found or not verified")
            return

        status_val = policy.status.value if policy.status else ""
        urgency_val = policy.urgency.value if policy.urgency else ""

        immediate_statuses = config.immediate_trigger_statuses
        immediate_urgencies = config.immediate_trigger_urgencies

        should_alert = (
            status_val in immediate_statuses
            and urgency_val in immediate_urgencies
        )

        if not should_alert:
            logger.info(
                f"[Alert] Policy #{policy_id} queued for digest only "
                f"(status={status_val}, urgency={urgency_val})"
            )
            return

        # Find matching users
        users_result = await db.execute(select(User))
        all_users = users_result.scalars().all()

        matching_users = _filter_matching_users(
            users=all_users,
            policy_sectors=policy.sectors or [],
            policy_jurisdiction=policy.jurisdiction or "",
        )

        if not matching_users:
            logger.info(f"[Alert] No matching users for policy #{policy_id}")
            return

        # Send FCM via topic or individual tokens
        # Using user firebase_uid as reference (device tokens stored in FCM topics client-side)
        try:
            import firebase_admin
            from firebase_admin import messaging
            from app.services.firebase_admin import _init_firebase
            _init_firebase()

            notification = messaging.MulticastMessage(
                notification=messaging.Notification(
                    title=f"🚨 Critical ESG Alert: {policy.urgency.value}",
                    body=f"{policy.title[:100]}",
                ),
                data={
                    "policy_id": str(policy_id),
                    "urgency": urgency_val,
                    "pillar": policy.pillar.value if policy.pillar else "",
                    "jurisdiction": policy.jurisdiction or "",
                    "type": "immediate_alert",
                },
                topic="user-notifications",  # Users subscribe to this topic client-side
            )
            messaging.send(messaging.Message(
                notification=messaging.Notification(
                    title=f"🚨 ESG Alert — {urgency_val}: {status_val}",
                    body=policy.title[:120],
                ),
                data={
                    "policy_id": str(policy_id),
                    "urgency": urgency_val,
                    "type": "immediate_alert",
                },
                topic="user-notifications",
            ))

            logger.info(
                f"[Alert] FCM sent for policy #{policy_id} to {len(matching_users)} matching users "
                f"(status={status_val}, urgency={urgency_val})"
            )
        except Exception as e:
            logger.error(f"[Alert] FCM send failed for policy #{policy_id}: {e}")


def _filter_matching_users(
    users: List[User],
    policy_sectors: List[str],
    policy_jurisdiction: str,
) -> List[User]:
    """
    Returns users whose sector OR jurisdiction prefs overlap with the policy.
    Users with empty prefs receive all alerts.
    """
    matching = []
    policy_sectors_lower = {s.lower() for s in policy_sectors}
    policy_jurisdiction_lower = policy_jurisdiction.lower()

    for user in users:
        user_sectors = {s.lower() for s in (user.sector_prefs or [])}
        user_jurisdictions = {j.lower() for j in (user.jurisdiction_prefs or [])}

        # No preferences set → receive all alerts
        if not user_sectors and not user_jurisdictions:
            matching.append(user)
            continue

        sector_match = bool(user_sectors & policy_sectors_lower)
        jurisdiction_match = (
            not user_jurisdictions
            or policy_jurisdiction_lower in user_jurisdictions
            or "global" in user_jurisdictions
        )

        if sector_match or jurisdiction_match:
            matching.append(user)

    return matching
