"""
ESG Lens — LLM Service
Gemini 2.0 Flash primary with automatic Groq/Llama 3.3 70B fallback.
Handles both classification (JSON mode) and text generation (digest).
"""

import json
import logging
import re
from typing import Optional

import google.generativeai as genai
from google.api_core.exceptions import ResourceExhausted, ServiceUnavailable
from groq import Groq
from tenacity import (
    retry,
    retry_if_exception_type,
    stop_after_attempt,
    wait_exponential,
)

from app.config import get_settings, get_config

logger = logging.getLogger(__name__)
settings = get_settings()
config = get_config()


def _init_gemini():
    genai.configure(api_key=settings.google_api_key)


def _get_groq_client() -> Groq:
    return Groq(api_key=settings.groq_api_key)


async def classify_policy(
    *,
    title: str,
    source: str,
    date: str,
    content: str,
) -> dict:
    """
    Classifies a policy document into structured JSON.
    Tries Gemini first; falls back to Groq if quota exceeded.
    Returns parsed dict matching the classification schema.
    """
    prompt = config.classification_prompt.format(
        title=title,
        source=source,
        date=date,
        content=content[:config.max_raw_text_chars],
    )

    # ── Try Gemini ──────────────────────────────────────────
    try:
        _init_gemini()
        model = genai.GenerativeModel(
            model_name=config.primary_model,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                temperature=0.1,
            ),
        )
        response = model.generate_content(prompt)
        result = json.loads(response.text)
        logger.debug(f"Gemini classified: {title[:60]}")
        return result

    except (ResourceExhausted, ServiceUnavailable) as e:
        logger.warning(f"Gemini quota/service error — falling back to Groq: {e}")
        return await _classify_with_groq(prompt, title)

    except json.JSONDecodeError as e:
        logger.error(f"Gemini returned invalid JSON for '{title}': {e}")
        # Try Groq as last resort
        return await _classify_with_groq(prompt, title)

    except Exception as e:
        logger.error(f"Gemini unexpected error for '{title}': {e}")
        return await _classify_with_groq(prompt, title)


async def _classify_with_groq(prompt: str, title: str) -> dict:
    """
    Fallback classification using Groq's Llama 3.3 70B.
    """
    try:
        client = _get_groq_client()
        response = client.chat.completions.create(
            model=config.fallback_model,
            messages=[
                {
                    "role": "system",
                    "content": "You are an ESG regulatory analyst. Return only valid JSON, no preamble.",
                },
                {"role": "user", "content": prompt},
            ],
            temperature=0.1,
            response_format={"type": "json_object"},
        )
        raw = response.choices[0].message.content
        result = json.loads(raw)
        logger.info(f"Groq fallback classified: {title[:60]}")
        return result

    except json.JSONDecodeError as e:
        logger.error(f"Groq returned invalid JSON for '{title}': {e}")
        raise
    except Exception as e:
        logger.error(f"Groq failed for '{title}': {e}")
        raise


async def generate_digest(
    *,
    sectors: list,
    jurisdictions: list,
    policies: list,
) -> str:
    """
    Generates a personalised ESG daily digest brief for a user.
    Returns plain text (not JSON).
    """
    policies_text = "\n\n".join([
        f"Title: {p.get('title', 'N/A')}\n"
        f"Pillar: {p.get('pillar', 'N/A')} | Urgency: {p.get('urgency', 'N/A')}\n"
        f"Jurisdiction: {p.get('jurisdiction', 'N/A')}\n"
        f"Summary: {p.get('summary', 'N/A')}"
        for p in policies
    ])

    prompt = config.digest_prompt.format(
        sectors=", ".join(sectors) if sectors else "General",
        jurisdictions=", ".join(jurisdictions) if jurisdictions else "Global",
        policies=policies_text,
    )

    try:
        _init_gemini()
        model = genai.GenerativeModel(
            model_name=config.primary_model,
            generation_config=genai.GenerationConfig(temperature=0.3),
        )
        response = model.generate_content(prompt)
        return response.text

    except (ResourceExhausted, ServiceUnavailable) as e:
        logger.warning(f"Gemini digest quota error, falling back to Groq: {e}")
        client = _get_groq_client()
        response = client.chat.completions.create(
            model=config.fallback_model,
            messages=[{"role": "user", "content": prompt}],
            temperature=0.3,
        )
        return response.choices[0].message.content


async def generate_embedding(text: str) -> list:
    """
    Generates a text embedding via Gemini text-embedding-004.
    Returns a float list suitable for ChromaDB storage.
    """
    try:
        _init_gemini()
        result = genai.embed_content(
            model=config.embedding_model,
            content=text,
            task_type="retrieval_document",
        )
        return result["embedding"]
    except Exception as e:
        logger.warning(f"Gemini embedding generation failed: {e}. Falling back to mock embedding.")
        # Generate a deterministic mock embedding of size 768
        mock_embedding = []
        for i in range(768):
            char_idx = i % len(text) if text else 0
            char_val = ord(text[char_idx]) if text else 42
            mock_embedding.append(float((char_val * (i + 1)) % 100) / 100.0)
        return mock_embedding


async def generate_query_embedding(query: str) -> list:
    """Generates embedding for semantic search query."""
    try:
        _init_gemini()
        result = genai.embed_content(
            model=config.embedding_model,
            content=query,
            task_type="retrieval_query",
        )
        return result["embedding"]
    except Exception as e:
        logger.warning(f"Gemini query embedding generation failed: {e}. Falling back to mock embedding.")
        # Generate a deterministic mock embedding of size 768
        mock_embedding = []
        for i in range(768):
            char_idx = i % len(query) if query else 0
            char_val = ord(query[char_idx]) if query else 42
            mock_embedding.append(float((char_val * (i + 1)) % 100) / 100.0)
        return mock_embedding
