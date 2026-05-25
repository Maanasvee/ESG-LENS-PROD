"""
ESG Lens — Agent 1: Scraper
Fetches from all active RSS and Playwright sources.
RSS via feedparser; Playwright for JS-rendered India government portals.
Includes RAM guard: skips Playwright if system RAM is critically low.
"""

import asyncio
import hashlib
import logging
import re
from datetime import datetime, timezone
from typing import List, Optional

import feedparser
import httpx
import psutil
from sqlalchemy import select

from app.config import get_config
from app.db.models import Source, FetchStrategy
from app.db.session import db_context

logger = logging.getLogger(__name__)
config = get_config()


def _check_ram_guard() -> bool:
    """Returns True if we have enough RAM for Playwright."""
    available_mb = psutil.virtual_memory().available / (1024 * 1024)
    guard_mb = config.playwright_ram_guard_mb
    if available_mb < guard_mb:
        logger.warning(
            f"[Scraper] RAM guard triggered: {available_mb:.0f}MB available < {guard_mb}MB threshold. "
            "Skipping Playwright scrapers this run."
        )
        return False
    return True


def _clean_text(text: str, max_chars: int) -> str:
    """Strips HTML tags and truncates."""
    clean = re.sub(r"<[^>]+>", " ", text or "")
    clean = re.sub(r"\s+", " ", clean).strip()
    return clean[:max_chars]


async def _fetch_rss_source(source: dict, source_id: Optional[int] = None) -> List[dict]:
    """Fetches and parses a single RSS feed."""
    items = []
    try:
        feed = feedparser.parse(source["url"])
        if feed.bozo and not feed.entries:
            logger.warning(f"[RSS] Malformed feed for {source['name']}: {feed.bozo_exception}")
            return []

        for entry in feed.entries[:30]:  # Cap at 30 per feed
            raw_text = _clean_text(
                entry.get("summary", "") + " " + entry.get("content", [{}])[0].get("value", ""),
                config.max_raw_text_chars,
            )

            # Parse date
            pub_date = None
            if hasattr(entry, "published_parsed") and entry.published_parsed:
                import time
                pub_date = datetime(*entry.published_parsed[:6], tzinfo=timezone.utc).isoformat()

            items.append({
                "source_id": source_id,
                "source_name": source["name"],
                "url": entry.get("link", ""),
                "title": entry.get("title", "Untitled"),
                "raw_text": raw_text,
                "published_date": pub_date,
                "jurisdiction": source.get("jurisdiction"),
                "pillar_hint": source.get("pillar_hint"),
            })

        logger.debug(f"[RSS] {source['name']}: {len(items)} entries")
    except Exception as e:
        logger.error(f"[RSS] Failed for {source['name']}: {e}")
    return items


async def _fetch_playwright_source(source: dict, source_id: Optional[int] = None) -> List[dict]:
    """
    Fetches a JS-rendered portal page via Playwright.
    Extracts links matching the configured CSS selector.
    """
    items = []
    try:
        from playwright.async_api import async_playwright

        async with async_playwright() as p:
            browser = await p.chromium.launch(
                args=[
                    "--no-sandbox",
                    "--disable-setuid-sandbox",
                    "--disable-dev-shm-usage",
                    "--disable-gpu",
                    "--single-process",
                ]
            )
            page = await browser.new_page(
                extra_http_headers={"User-Agent": config.scraping.get("user_agent", "ESGLens/1.0")}
            )
            await page.goto(
                source["url"],
                timeout=config.playwright_timeout_ms,
                wait_until="domcontentloaded",
            )

            # Wait briefly for JS rendering
            await asyncio.sleep(2)

            selector = source.get("selector", "a")
            links = await page.query_selector_all(selector)

            for link in links[:20]:  # Cap at 20 per portal
                try:
                    href = await link.get_attribute("href")
                    text = (await link.inner_text()).strip()

                    if not href or not text or len(text) < 10:
                        continue

                    # Resolve relative URLs
                    if href.startswith("/"):
                        from urllib.parse import urlparse
                        base = source["url"]
                        parsed = urlparse(base)
                        href = f"{parsed.scheme}://{parsed.netloc}{href}"
                    elif not href.startswith("http"):
                        continue

                    # Fetch article text
                    raw_text = text  # Minimal — full text fetched by classifier if needed
                    try:
                        async with httpx.AsyncClient(timeout=10) as client:
                            resp = await client.get(href, follow_redirects=True)
                            if resp.status_code == 200:
                                raw_text = _clean_text(resp.text, config.max_raw_text_chars)
                    except Exception:
                        pass

                    items.append({
                        "source_id": source_id,
                        "source_name": source["name"],
                        "url": href,
                        "title": text[:512],
                        "raw_text": raw_text,
                        "published_date": None,
                        "jurisdiction": source.get("jurisdiction"),
                        "pillar_hint": source.get("pillar_hint"),
                    })
                except Exception as e:
                    logger.debug(f"[Playwright] Link extraction error: {e}")

            await browser.close()
            logger.debug(f"[Playwright] {source['name']}: {len(items)} links")

    except Exception as e:
        logger.error(f"[Playwright] Failed for {source['name']}: {e}")

    return items


async def run_scraper() -> List[dict]:
    """
    Runs all active sources from PostgreSQL.
    If a source exists in DB, uses DB record; otherwise falls back to config.yaml.
    Returns normalised list of raw items.
    """
    all_items = []
    ram_ok = _check_ram_guard()

    # Load active sources from PostgreSQL
    async with db_context() as db:
        result = await db.execute(select(Source).where(Source.is_active == True))
        db_sources = result.scalars().all()

        # Build source dicts from DB records
        sources_to_scrape = [
            {
                "id": s.id,
                "name": s.name,
                "url": s.url,
                "fetch_strategy": s.fetch_strategy.value,
                "selector": s.selector,
                "jurisdiction": s.jurisdiction,
                "pillar_hint": s.pillar_hint,
            }
            for s in db_sources
        ]

    if not sources_to_scrape:
        # Fallback: use config.yaml if DB has no sources yet
        logger.warning("[Scraper] No active sources in DB; falling back to config.yaml")
        sources_to_scrape = config.all_sources

    # Separate by strategy
    rss_sources = [s for s in sources_to_scrape if s.get("fetch_strategy") == "rss"]
    playwright_sources = [s for s in sources_to_scrape if s.get("fetch_strategy") == "playwright"]

    # ── RSS (concurrent) ──────────────────────────────────────
    rss_tasks = [
        _fetch_rss_source(s, s.get("id"))
        for s in rss_sources
    ]
    rss_results = await asyncio.gather(*rss_tasks, return_exceptions=True)
    for r in rss_results:
        if isinstance(r, list):
            all_items.extend(r)
        elif isinstance(r, Exception):
            logger.error(f"[RSS] Task error: {r}")

    # ── Playwright (sequential with concurrency cap) ──────────
    if playwright_sources and ram_ok:
        max_concurrent = config.scraping.get("playwright_max_concurrent", 3)
        sem = asyncio.Semaphore(max_concurrent)

        async def _throttled_playwright(source):
            async with sem:
                return await _fetch_playwright_source(source, source.get("id"))

        pw_tasks = [_throttled_playwright(s) for s in playwright_sources]
        pw_results = await asyncio.gather(*pw_tasks, return_exceptions=True)
        for r in pw_results:
            if isinstance(r, list):
                all_items.extend(r)
            elif isinstance(r, Exception):
                logger.error(f"[Playwright] Task error: {r}")
    elif playwright_sources and not ram_ok:
        logger.warning(f"[Scraper] Skipped {len(playwright_sources)} Playwright sources due to RAM guard")

    # Filter items with empty URLs or titles
    all_items = [i for i in all_items if i.get("url") and i.get("title")]
    logger.info(f"[Scraper] Total raw items: {len(all_items)}")
    return all_items
