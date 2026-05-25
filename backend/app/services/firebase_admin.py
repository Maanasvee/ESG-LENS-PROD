"""
ESG Lens — Firebase Admin Service
Handles:
  1. Firebase ID token verification (for auth middleware)
  2. FCM push notification dispatch
"""

import logging
from functools import lru_cache
from typing import List, Optional

import firebase_admin
from firebase_admin import auth, credentials, messaging

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

_initialized = False


def _init_firebase():
    global _initialized
    if _initialized or firebase_admin._apps:
        _initialized = True
        return
    try:
        cred_data = settings.get_firebase_credentials()
        cred = credentials.Certificate(cred_data)
        firebase_admin.initialize_app(cred)
        _initialized = True
        logger.info("Firebase Admin SDK initialized successfully")
    except Exception as e:
        logger.warning(f"Firebase Admin SDK initialization skipped: {e}")
        if settings.app_env != "development":
            raise


def get_firebase_app():
    _init_firebase()
    if not _initialized:
        return None
    return firebase_admin.get_app()


async def verify_firebase_token(id_token: str) -> dict:
    """
    Verifies a Firebase ID token and returns the decoded claims.
    Raises firebase_admin.auth.InvalidIdTokenError on failure.
    """
    _init_firebase()
    if not _initialized:
        raise ValueError("Firebase Admin SDK is not initialized (Development Mock Mode)")
    decoded = auth.verify_id_token(id_token, check_revoked=True)
    return decoded


async def send_fcm_notification(
    *,
    tokens: List[str],
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> dict:
    """
    Sends FCM push notification to a list of device tokens.
    Returns FCM batch response.
    Silently ignores empty token lists.
    """
    if not tokens:
        return {"success_count": 0, "failure_count": 0}

    _init_firebase()
    if not _initialized:
        logger.warning(f"FCM Notification dispatch skipped (Firebase not initialized). Title: '{title}', Body: '{body}'")
        return {"success_count": len(tokens), "failure_count": 0}

    messages = [
        messaging.Message(
            notification=messaging.Notification(title=title, body=body),
            data={k: str(v) for k, v in (data or {}).items()},
            token=token,
        )
        for token in tokens
    ]

    batch_response = messaging.send_each(messages)

    success = batch_response.success_count
    failure = batch_response.failure_count

    if failure > 0:
        for i, resp in enumerate(batch_response.responses):
            if not resp.success:
                logger.warning(f"FCM send failed for token index {i}: {resp.exception}")

    logger.info(f"FCM dispatch: {success} success, {failure} failed of {len(tokens)} tokens")
    return {"success_count": success, "failure_count": failure}


async def send_admin_notification(
    *,
    db_session,
    title: str,
    body: str,
    data: Optional[dict] = None,
) -> None:
    """
    Sends FCM to all users with role='admin'.
    Fetches FCM tokens from DB — admin users must have registered their device token.
    NOTE: FCM token storage is handled client-side in frontend; this queries users table.
    """
    from sqlalchemy import select
    from app.db.models import User, UserRole

    result = await db_session.execute(
        select(User).where(User.role == UserRole.admin)
    )
    admins = result.scalars().all()

    # In a real setup, FCM device tokens would be stored in a separate fcm_tokens table
    # For now, we use firebase_uid as a topic subscription: admin-notifications
    _init_firebase()
    if not _initialized:
        logger.warning(f"Admin FCM Topic dispatch skipped (Firebase not initialized). Title: '{title}', Body: '{body}'")
        return
        
    topic_message = messaging.Message(
        notification=messaging.Notification(title=title, body=body),
        data={k: str(v) for k, v in (data or {}).items()},
        topic="admin-notifications",
    )
    messaging.send(topic_message)
    logger.info(f"FCM topic 'admin-notifications' sent: {title}")
