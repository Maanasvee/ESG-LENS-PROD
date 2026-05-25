"""
ESG Lens — Agent 3.5: Policy Normaliser
Resolves policy aliases to master records.
Prevents fragmented duplicate records for policies known by multiple names
(e.g., CSRD, Corporate Sustainability Reporting Directive).
"""

import logging
from typing import List

from sqlalchemy import select

from app.config import get_config
from app.db.models import PolicyAlias
from app.db.session import db_context

logger = logging.getLogger(__name__)
config = get_config()


async def run_normaliser(classified_items: List[dict]) -> List[dict]:
    """
    For each classified policy, checks if its title or common abbreviation
    matches a known alias in the policy_aliases table.
    If a match is found, sets master_policy_id on the item.
    Items with master_policy_id will be skipped for new insertion (alias linking only).
    """
    if not classified_items:
        return []

    # Load all known aliases from DB
    async with db_context() as db:
        result = await db.execute(
            select(PolicyAlias.alias_text, PolicyAlias.master_policy_id)
        )
        alias_rows = result.all()

    # Build case-insensitive alias map
    alias_map = {
        row.alias_text.lower().strip(): row.master_policy_id
        for row in alias_rows
    }

    normalised = []
    for item in classified_items:
        title_lower = item.get("title", "").lower().strip()
        matched_master_id = None

        # Check if title contains any known alias
        for alias_text, master_id in alias_map.items():
            if alias_text in title_lower or title_lower in alias_text:
                matched_master_id = master_id
                logger.info(
                    f"[Normaliser] Alias match: '{item['title']}' → master_policy_id={master_id}"
                )
                break

        item_copy = dict(item)
        item_copy["master_policy_id"] = matched_master_id
        normalised.append(item_copy)

    logger.info(
        f"[Normaliser] {len(normalised)} items processed, "
        f"{sum(1 for i in normalised if i.get('master_policy_id'))} alias-linked"
    )
    return normalised
