"""
ESG Lens — Auth Middleware
Verifies Firebase ID tokens on every protected request.
Attaches decoded user claims + DB user record to request.state.
"""

import logging
from typing import Optional

from fastapi import Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User, UserRole
from app.db.session import get_db
from app.services.firebase_admin import verify_firebase_token

logger = logging.getLogger(__name__)

bearer_scheme = HTTPBearer(auto_error=False)


async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    """
    FastAPI dependency that:
    1. Extracts Bearer token from Authorization header
    2. Verifies it against Firebase
    3. Looks up (or creates) the user in PostgreSQL
    4. Returns the User ORM object
    """
    if not credentials or not credentials.credentials:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    token = credentials.credentials

    # Development Mock Authentication Bypass
    from app.config import get_settings
    settings = get_settings()
    if settings.app_env == "development" and token.startswith("mock-"):
        parts = token.split(":")
        role_part = "admin" if "admin" in parts[0] else "user"
        email = parts[1] if len(parts) > 1 else f"{role_part}@bevolve.ai"
        firebase_uid = token
        
        # Build user name from email prefix
        prefix_parts = email.split("@")[0].split(".")
        name = " ".join(p.capitalize() for p in prefix_parts) if prefix_parts else f"Mock {role_part.capitalize()}"
        
        result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
        user = result.scalar_one_or_none()
        
        if user is None:
            user = User(
                firebase_uid=firebase_uid,
                email=email,
                name=name,
                role=UserRole.admin if role_part == "admin" else UserRole.user,
            )
            db.add(user)
            await db.flush()
            logger.info(f"Mock user registered in development: {email} (role={user.role})")
        return user

    try:
        decoded = await verify_firebase_token(token)
    except Exception as e:
        logger.warning(f"Firebase token verification failed: {e}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )

    firebase_uid = decoded.get("uid")
    email = decoded.get("email", "")
    name = decoded.get("name")

    # Upsert user in PostgreSQL
    result = await db.execute(select(User).where(User.firebase_uid == firebase_uid))
    user = result.scalar_one_or_none()

    if user is None:
        user = User(
            firebase_uid=firebase_uid,
            email=email,
            name=name,
            role=UserRole.user,
        )
        db.add(user)
        await db.flush()
        logger.info(f"New user registered: {email} (uid={firebase_uid})")

    return user


async def require_admin(
    current_user: User = Depends(get_current_user),
) -> User:
    """
    Dependency that enforces admin role.
    Use on all /admin/* routes.
    """
    if current_user.role != UserRole.admin:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )
    return current_user


async def get_pipeline_auth(request: Request) -> bool:
    """
    Validates X-Pipeline-Secret header for internal pipeline endpoints.
    Used by GitHub Actions cron calls.
    """
    from app.config import get_settings
    settings = get_settings()

    secret = request.headers.get("X-Pipeline-Secret")
    if not secret or secret != settings.pipeline_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid pipeline secret",
        )
    return True
