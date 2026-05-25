"""ESG Lens — Users API"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import List, Optional
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models import User
from app.db.session import get_db
from app.middleware.auth import get_current_user
from app.config import get_config

router = APIRouter(prefix="/api/users", tags=["users"])
config = get_config()


class UserPrefsUpdate(BaseModel):
    sector_prefs: Optional[List[str]] = None
    jurisdiction_prefs: Optional[List[str]] = None
    email_digest_opt_in: Optional[bool] = None


class UserResponse(BaseModel):
    id: int
    firebase_uid: str
    email: str
    name: Optional[str]
    role: str
    sector_prefs: List[str]
    jurisdiction_prefs: List[str]
    email_digest_opt_in: bool

    class Config:
        from_attributes = True


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: User = Depends(get_current_user)):
    """Returns current user's profile. Auto-creates user on first call."""
    return current_user


@router.patch("/prefs", response_model=UserResponse)
async def update_prefs(
    prefs: UserPrefsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Updates user notification preferences."""
    # Validate sectors and jurisdictions against config taxonomy
    valid_sectors = set(config.sectors)
    valid_jurisdictions = set(config.jurisdictions)

    if prefs.sector_prefs is not None:
        invalid = set(prefs.sector_prefs) - valid_sectors
        if invalid:
            raise HTTPException(400, f"Invalid sectors: {invalid}")
        current_user.sector_prefs = prefs.sector_prefs

    if prefs.jurisdiction_prefs is not None:
        invalid = set(prefs.jurisdiction_prefs) - valid_jurisdictions
        if invalid:
            raise HTTPException(400, f"Invalid jurisdictions: {invalid}")
        current_user.jurisdiction_prefs = prefs.jurisdiction_prefs

    if prefs.email_digest_opt_in is not None:
        current_user.email_digest_opt_in = prefs.email_digest_opt_in

    db.add(current_user)
    return current_user


@router.get("/taxonomy")
async def get_taxonomy():
    """Returns available sectors and jurisdictions for settings UI."""
    return {
        "sectors": config.sectors,
        "jurisdictions": config.jurisdictions,
    }
