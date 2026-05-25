"""ESG Lens — Pipeline & Digest Trigger Endpoints"""

import asyncio
import logging
from datetime import datetime, timezone
from fastapi import APIRouter, BackgroundTasks, Depends

from app.db.session import db_context
from app.db.models import PipelineRun
from app.middleware.auth import get_pipeline_auth

router = APIRouter(prefix="/api", tags=["pipeline"])
logger = logging.getLogger(__name__)


@router.post("/run-pipeline")
async def run_pipeline(
    background_tasks: BackgroundTasks,
    _auth=Depends(get_pipeline_auth),
):
    """
    Triggers the full 6-agent LangGraph pipeline.
    Called by GitHub Actions cron every 30 minutes.
    Requires X-Pipeline-Secret header.
    Returns immediately; pipeline runs in background.
    """
    background_tasks.add_task(_run_pipeline_background)
    return {"status": "pipeline_started", "triggered_at": datetime.now(timezone.utc).isoformat()}


async def _run_pipeline_background():
    from app.agents.graph import run_pipeline_graph
    try:
        await run_pipeline_graph()
    except Exception as e:
        logger.error(f"Pipeline background task failed: {e}")


@router.post("/run-digest")
async def run_digest(
    background_tasks: BackgroundTasks,
    phase: str = "generate",  # "generate" | "dispatch"
    _auth=Depends(get_pipeline_auth),
):
    """
    Triggers digest generation (7:30 PM IST) or dispatch (8:00 AM IST).
    Called by separate GitHub Actions cron jobs.
    """
    if phase == "generate":
        background_tasks.add_task(_run_digest_generate)
    elif phase == "dispatch":
        background_tasks.add_task(_run_digest_dispatch)
    else:
        from fastapi import HTTPException
        raise HTTPException(400, "phase must be 'generate' or 'dispatch'")

    return {"status": f"digest_{phase}_started", "triggered_at": datetime.now(timezone.utc).isoformat()}


async def _run_digest_generate():
    from app.agents.digest import run_digest_generation
    try:
        await run_digest_generation()
    except Exception as e:
        logger.error(f"Digest generation failed: {e}")


async def _run_digest_dispatch():
    from app.agents.digest import run_digest_dispatch
    try:
        await run_digest_dispatch()
    except Exception as e:
        logger.error(f"Digest dispatch failed: {e}")


@router.get("/pipeline/status")
async def pipeline_status(_auth=Depends(get_pipeline_auth)):
    """Returns the status of the most recent pipeline run."""
    async with db_context() as db:
        from sqlalchemy import select
        result = await db.execute(
            select(PipelineRun).order_by(PipelineRun.triggered_at.desc()).limit(1)
        )
        run = result.scalar_one_or_none()
        if not run:
            return {"status": "no_runs"}
        return {
            "id": run.id,
            "triggered_at": run.triggered_at.isoformat(),
            "completed_at": run.completed_at.isoformat() if run.completed_at else None,
            "items_fetched": run.items_fetched,
            "items_after_dedup": run.items_after_dedup,
            "llm_calls_made": run.llm_calls_made,
            "errors": run.errors,
            "duration_seconds": run.duration_seconds,
        }
