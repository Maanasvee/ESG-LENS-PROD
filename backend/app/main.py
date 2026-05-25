"""
ESG Lens — FastAPI Application Entry Point
"""

import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware

from app.api import admin, pipeline, policies, search, users
from app.config import get_config, get_settings
from app.db.models import Base
from app.db.session import engine

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)
settings = get_settings()
config = get_config()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup/shutdown lifecycle."""
    logger.info("ESG Lens backend starting up...")

    # Create all tables if they don't exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("Database tables verified/created")

    # Seed sources from config.yaml if sources table is empty
    await _seed_sources_if_empty()
    logger.info("Sources seeded from config.yaml (if needed)")

    yield

    logger.info("ESG Lens backend shutting down...")
    await engine.dispose()


async def _seed_sources_if_empty():
    """Seeds the sources table from config.yaml on first startup."""
    from sqlalchemy import select, func
    from app.db.models import Source, FetchStrategy
    from app.db.session import db_context

    async with db_context() as db:
        count = (await db.execute(select(func.count()).select_from(Source))).scalar_one()
        if count > 0:
            logger.info(f"Sources table already has {count} records — skipping seed")
            return

        config = get_config()
        sources_to_seed = []

        for s in config.rss_sources:
            sources_to_seed.append(Source(
                name=s["name"],
                url=s["url"],
                source_type="news" if any(k in s["name"].lower() for k in ["news", "today", "brief", "views"]) else "standard",
                fetch_strategy=FetchStrategy.rss,
                frequency_minutes=s.get("frequency_minutes", 30),
                is_active=s.get("is_active", True),
                jurisdiction=s.get("jurisdiction"),
                pillar_hint=s.get("pillar_hint"),
            ))

        for s in config.playwright_sources:
            sources_to_seed.append(Source(
                name=s["name"],
                url=s["url"],
                source_type="portal",
                fetch_strategy=FetchStrategy.playwright,
                frequency_minutes=s.get("frequency_minutes", 60),
                is_active=s.get("is_active", True),
                selector=s.get("selector"),
                jurisdiction=s.get("jurisdiction"),
                pillar_hint=s.get("pillar_hint"),
            ))

        for src in sources_to_seed:
            db.add(src)

        logger.info(f"Seeded {len(sources_to_seed)} sources from config.yaml")


# ──────────────────────────────────────────────────────────────
# FastAPI App
# ──────────────────────────────────────────────────────────────

app = FastAPI(
    title="ESG Lens API",
    description="Bevolve.ai ESG Policy Intelligence Platform",
    version="1.0.0",
    lifespan=lifespan,
)

# ── Middleware ─────────────────────────────────────────────────

app.add_middleware(GZipMiddleware, minimum_size=1000)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        settings.frontend_url,
        "https://eslens.bevolve.ai",
        "https://bevolve.ai",
        "https://*.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Routers ────────────────────────────────────────────────────

app.include_router(users.router)
app.include_router(policies.router)
app.include_router(search.router)
app.include_router(admin.router)
app.include_router(pipeline.router)


# ── Health Check ───────────────────────────────────────────────

@app.get("/health")
async def health():
    return {
        "status": "ok",
        "service": "ESG Lens API",
        "version": "1.0.0",
        "environment": settings.app_env,
    }


@app.get("/")
async def root():
    return {"message": "ESG Lens API by Bevolve.ai", "docs": "/docs"}
