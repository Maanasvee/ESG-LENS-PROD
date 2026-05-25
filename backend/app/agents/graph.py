"""
ESG Lens — LangGraph Agent Pipeline
6-agent stateful graph: Scraper → Dedup → Classifier → Normaliser → DB Write → Alert
"""

import logging
from datetime import datetime, timezone
from typing import List, Optional, TypedDict

from langgraph.graph import END, START, StateGraph

from app.db.session import db_context
from app.db.models import PipelineRun

logger = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────
# State Definition
# ──────────────────────────────────────────────────────────────

class RawItem(TypedDict):
    source_id: Optional[int]
    source_name: str
    url: str
    title: str
    raw_text: str
    published_date: Optional[str]
    jurisdiction: Optional[str]
    pillar_hint: Optional[str]


class ClassifiedPolicy(TypedDict):
    source_id: Optional[int]
    source_url: str
    raw_text: str
    title: str
    source: str
    date: str
    jurisdiction: str
    pillar: str
    sectors: List[str]
    status: str
    urgency: str
    summary: str
    master_policy_id: Optional[int]


class AgentState(TypedDict):
    raw_items: List[RawItem]
    deduped_items: List[RawItem]
    classified_items: List[ClassifiedPolicy]
    normalised_items: List[ClassifiedPolicy]
    items_fetched: int
    items_after_dedup: int
    llm_calls_made: int
    errors: List[str]
    pipeline_run_id: Optional[int]
    llm_quota_exceeded: bool


# ──────────────────────────────────────────────────────────────
# Node Functions
# ──────────────────────────────────────────────────────────────

async def scraper_node(state: AgentState) -> AgentState:
    """Agent 1: Fetch from all active RSS and Playwright sources."""
    from app.agents.scraper import run_scraper
    try:
        items = await run_scraper()
        state["raw_items"] = items
        state["items_fetched"] = len(items)
        logger.info(f"[Scraper] Fetched {len(items)} raw items")
    except Exception as e:
        logger.error(f"[Scraper] Error: {e}")
        state["errors"].append(f"Scraper: {str(e)}")
        state["raw_items"] = []
        state["items_fetched"] = 0
    return state


async def dedup_node(state: AgentState) -> AgentState:
    """Agent 2: SHA-256 URL deduplication against seen_hashes."""
    from app.agents.dedup import run_dedup
    try:
        deduped = await run_dedup(state["raw_items"])
        state["deduped_items"] = deduped
        state["items_after_dedup"] = len(deduped)
        logger.info(f"[Dedup] {state['items_fetched']} → {len(deduped)} after dedup")
    except Exception as e:
        logger.error(f"[Dedup] Error: {e}")
        state["errors"].append(f"Dedup: {str(e)}")
        state["deduped_items"] = state.get("raw_items", [])
    return state


async def classifier_node(state: AgentState) -> AgentState:
    """Agent 3: Gemini/Groq JSON classification of each new item."""
    from app.agents.classifier import run_classifier
    if not state.get("deduped_items"):
        state["classified_items"] = []
        return state
    try:
        classified, llm_calls, quota_exceeded = await run_classifier(state["deduped_items"])
        state["classified_items"] = classified
        state["llm_calls_made"] = llm_calls
        state["llm_quota_exceeded"] = quota_exceeded
        logger.info(f"[Classifier] Classified {len(classified)} items ({llm_calls} LLM calls)")
    except Exception as e:
        logger.error(f"[Classifier] Error: {e}")
        state["errors"].append(f"Classifier: {str(e)}")
        state["classified_items"] = []
    return state


async def normaliser_node(state: AgentState) -> AgentState:
    """Agent 3.5: Policy alias resolution to prevent duplicate master records."""
    from app.agents.normaliser import run_normaliser
    if not state.get("classified_items"):
        state["normalised_items"] = []
        return state
    try:
        normalised = await run_normaliser(state["classified_items"])
        state["normalised_items"] = normalised
        logger.info(f"[Normaliser] {len(normalised)} policies after alias resolution")
    except Exception as e:
        logger.error(f"[Normaliser] Error: {e}")
        state["errors"].append(f"Normaliser: {str(e)}")
        state["normalised_items"] = state.get("classified_items", [])
    return state


async def db_write_node(state: AgentState) -> AgentState:
    """DB Write: Insert policies, generate embeddings, send admin FCM."""
    from app.agents.db_writer import run_db_write
    if not state.get("normalised_items"):
        logger.info("[DB Write] No new policies to write")
        return state
    try:
        await run_db_write(state["normalised_items"])
        logger.info(f"[DB Write] Wrote {len(state['normalised_items'])} policies")
    except Exception as e:
        logger.error(f"[DB Write] Error: {e}")
        state["errors"].append(f"DBWrite: {str(e)}")
    return state


async def alert_node(state: AgentState) -> AgentState:
    """Agent 4: Placeholder — actual alert triggered on admin approval, not here."""
    # Alert triggering is done via admin moderate endpoint -> trigger_alert_for_policy()
    # This node is kept as a stub for the graph structure
    logger.info("[Alert] Alert node complete (alerts dispatched on admin approval)")
    return state


def should_skip_classifier(state: AgentState) -> str:
    """Conditional edge: skip if no items after dedup."""
    if not state.get("deduped_items"):
        return "skip_to_end"
    return "classify"


# ──────────────────────────────────────────────────────────────
# Build Graph
# ──────────────────────────────────────────────────────────────

def build_pipeline_graph() -> StateGraph:
    graph = StateGraph(AgentState)

    graph.add_node("scraper", scraper_node)
    graph.add_node("dedup", dedup_node)
    graph.add_node("classifier", classifier_node)
    graph.add_node("normaliser", normaliser_node)
    graph.add_node("db_write", db_write_node)
    graph.add_node("alert", alert_node)

    graph.add_edge(START, "scraper")
    graph.add_edge("scraper", "dedup")
    graph.add_conditional_edges(
        "dedup",
        should_skip_classifier,
        {"classify": "classifier", "skip_to_end": END},
    )
    graph.add_edge("classifier", "normaliser")
    graph.add_edge("normaliser", "db_write")
    graph.add_edge("db_write", "alert")
    graph.add_edge("alert", END)

    return graph.compile()


# ──────────────────────────────────────────────────────────────
# Entry Point
# ──────────────────────────────────────────────────────────────

async def run_pipeline_graph():
    """Main entry point called by /run-pipeline endpoint."""
    pipeline = build_pipeline_graph()

    initial_state: AgentState = {
        "raw_items": [],
        "deduped_items": [],
        "classified_items": [],
        "normalised_items": [],
        "items_fetched": 0,
        "items_after_dedup": 0,
        "llm_calls_made": 0,
        "errors": [],
        "pipeline_run_id": None,
        "llm_quota_exceeded": False,
    }

    start_time = datetime.now(timezone.utc)

    # Create pipeline run record
    async with db_context() as db:
        run = PipelineRun(triggered_at=start_time)
        db.add(run)
        await db.flush()
        run_id = run.id
        initial_state["pipeline_run_id"] = run_id
        logger.info(f"Pipeline run #{run_id} started")

    # Execute graph
    final_state = await pipeline.ainvoke(initial_state)

    # Update pipeline run record
    end_time = datetime.now(timezone.utc)
    async with db_context() as db:
        from sqlalchemy import select
        result = await db.execute(select(PipelineRun).where(PipelineRun.id == run_id))
        run = result.scalar_one()
        run.items_fetched = final_state.get("items_fetched", 0)
        run.items_after_dedup = final_state.get("items_after_dedup", 0)
        run.llm_calls_made = final_state.get("llm_calls_made", 0)
        run.errors = final_state.get("errors", [])
        run.completed_at = end_time
        db.add(run)

    logger.info(
        f"Pipeline run #{run_id} completed in "
        f"{(end_time - start_time).total_seconds():.1f}s | "
        f"fetched={final_state['items_fetched']} "
        f"deduped={final_state['items_after_dedup']} "
        f"llm_calls={final_state['llm_calls_made']} "
        f"errors={len(final_state['errors'])}"
    )

    return final_state
