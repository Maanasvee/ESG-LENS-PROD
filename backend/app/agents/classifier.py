"""
ESG Lens — Agent 3: Classifier + Summariser
Sends each new item to Gemini 2.0 Flash in strict JSON mode.
Falls back to Groq Llama 3.3 70B on quota exhaustion.
Processes concurrently with rate limiting.
"""

import asyncio
import logging
from typing import List, Tuple

from app.config import get_config
from app.services.llm import classify_policy

logger = logging.getLogger(__name__)
config = get_config()

# Rate limit: Gemini free tier allows 15 RPM
_GEMINI_RATE_LIMIT_RPM = 15
_SEMAPHORE_SLOTS = 5  # Max concurrent LLM calls


def _validate_classification(result: dict) -> dict:
    """
    Validates and coerces classifier output to expected schema.
    Fills in defaults for missing/invalid fields.
    """
    valid_pillars = {"E", "S", "G"}
    valid_statuses = {"Proposed", "Consultation", "Enacted", "Amended"}
    valid_urgencies = {"Low", "Medium", "High", "Critical"}

    pillar = result.get("pillar", "G")
    if pillar not in valid_pillars:
        pillar = "G"

    status = result.get("status", "Proposed")
    if status not in valid_statuses:
        status = "Proposed"

    urgency = result.get("urgency", "Low")
    if urgency not in valid_urgencies:
        urgency = "Low"

    sectors = result.get("sectors", [])
    if not isinstance(sectors, list):
        sectors = [str(sectors)] if sectors else []

    return {
        "title": str(result.get("title", "Untitled Policy"))[:512],
        "source": str(result.get("source", "Unknown")),
        "date": str(result.get("date", ""))[:10],
        "jurisdiction": str(result.get("jurisdiction", "Global"))[:64],
        "pillar": pillar,
        "sectors": sectors[:10],  # Cap at 10 sectors
        "status": status,
        "urgency": urgency,
        "summary": str(result.get("summary", ""))[:2000],
    }


async def run_classifier(
    deduped_items: List[dict],
) -> Tuple[List[dict], int, bool]:
    """
    Classifies all deduped items concurrently (with rate limiting).
    Returns (classified_items, llm_calls_made, quota_exceeded).
    """
    classified = []
    llm_calls = 0
    quota_exceeded = False
    sem = asyncio.Semaphore(_SEMAPHORE_SLOTS)

    async def _classify_one(item: dict) -> dict:
        nonlocal llm_calls, quota_exceeded
        async with sem:
            try:
                result = await classify_policy(
                    title=item.get("title", ""),
                    source=item.get("source_name", ""),
                    date=item.get("published_date", "")[:10] if item.get("published_date") else "",
                    content=item.get("raw_text", ""),
                )
                validated = _validate_classification(result)
                llm_calls += 1
                # Merge with original item metadata
                return {
                    **validated,
                    "source_id": item.get("source_id"),
                    "source_url": item.get("url", ""),
                    "raw_text": item.get("raw_text", ""),
                    "master_policy_id": None,
                }
            except Exception as e:
                error_str = str(e).lower()
                if "quota" in error_str or "resource_exhausted" in error_str:
                    quota_exceeded = True
                logger.error(f"[Classifier] Failed for '{item.get('title', '')}': {e}")
                return None

    tasks = [_classify_one(item) for item in deduped_items]
    results = await asyncio.gather(*tasks, return_exceptions=False)

    classified = [r for r in results if r is not None]
    logger.info(f"[Classifier] {len(classified)}/{len(deduped_items)} items classified, {llm_calls} LLM calls")

    return classified, llm_calls, quota_exceeded
