"""
ESG Lens — Application Configuration
Loads config.yaml and merges with environment variables.
All runtime-configurable values live in config.yaml.
"""

import os
import json
from pathlib import Path
from functools import lru_cache
from typing import List, Optional

import yaml
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


BASE_DIR = Path(__file__).parent.parent  # backend/


class Settings(BaseSettings):
    """
    Environment variables. Sourced from .env file or Railway injected env vars.
    Override any value via environment without touching config.yaml.
    """

    model_config = SettingsConfigDict(
        env_file=BASE_DIR / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Application
    app_env: str = "development"
    pipeline_secret: str = "change-me"

    # Database
    database_url: str = "postgresql+asyncpg://user:pw@localhost:5432/eslens"

    # LLM
    google_api_key: str = ""
    groq_api_key: str = ""

    # ChromaDB
    chroma_persist_dir: str = "./chroma_data"

    # Firebase Admin
    firebase_project_id: str = ""
    firebase_service_account_path: str = "./firebase-service-account.json"
    firebase_service_account_json: Optional[str] = None  # JSON string fallback

    # Resend
    resend_api_key: str = ""
    resend_from_email: str = "eslens@bevolve.ai"

    # CORS
    frontend_url: str = "http://localhost:3000"

    @property
    def is_production(self) -> bool:
        return self.app_env == "production"

    def get_firebase_credentials(self) -> dict:
        """Returns Firebase service account as dict (from JSON string or file)."""
        if self.firebase_service_account_json:
            return json.loads(self.firebase_service_account_json)
        path = Path(self.firebase_service_account_path)
        if path.exists():
            return json.loads(path.read_text())
        raise ValueError(
            "Firebase credentials not found. Set FIREBASE_SERVICE_ACCOUNT_JSON "
            "or FIREBASE_SERVICE_ACCOUNT_PATH in your .env file."
        )


class AppConfig:
    """
    Loaded from config.yaml. Runtime-configurable without code changes.
    Supports hot-reload in development via explicit reload() call.
    """

    def __init__(self, config_path: Optional[Path] = None):
        self._path = config_path or (BASE_DIR / "config.yaml")
        self._data: dict = {}
        self.load()

    def load(self):
        with open(self._path, "r", encoding="utf-8") as f:
            self._data = yaml.safe_load(f)

    def reload(self):
        """Hot-reload config without restarting the server."""
        self.load()

    # ── LLM ────────────────────────────────────────────────
    @property
    def llm(self) -> dict:
        return self._data.get("llm", {})

    @property
    def primary_model(self) -> str:
        return self.llm.get("primary", "gemini-2.0-flash")

    @property
    def fallback_model(self) -> str:
        return self.llm.get("fallback", "llama-3.3-70b-versatile")

    @property
    def embedding_model(self) -> str:
        return self.llm.get("embedding_model", "models/text-embedding-004")

    @property
    def classification_prompt(self) -> str:
        return self.llm.get("classification_prompt", "")

    @property
    def digest_prompt(self) -> str:
        return self.llm.get("digest_prompt", "")

    # ── Scraping ────────────────────────────────────────────
    @property
    def scraping(self) -> dict:
        return self._data.get("scraping", {})

    @property
    def playwright_timeout_ms(self) -> int:
        return self.scraping.get("playwright_timeout_ms", 30000)

    @property
    def playwright_ram_guard_mb(self) -> int:
        return self.scraping.get("playwright_ram_guard_mb", 350)

    @property
    def max_raw_text_chars(self) -> int:
        return self.scraping.get("max_raw_text_chars", 50000)

    # ── Sources ─────────────────────────────────────────────
    @property
    def rss_sources(self) -> List[dict]:
        return self._data.get("sources", {}).get("rss", [])

    @property
    def playwright_sources(self) -> List[dict]:
        return self._data.get("sources", {}).get("playwright", [])

    @property
    def all_sources(self) -> List[dict]:
        rss = [{"fetch_strategy": "rss", **s} for s in self.rss_sources]
        pw = [{"fetch_strategy": "playwright", **s} for s in self.playwright_sources]
        return rss + pw

    # ── Alerts ──────────────────────────────────────────────
    @property
    def alerts(self) -> dict:
        return self._data.get("alerts", {})

    @property
    def immediate_trigger_statuses(self) -> List[str]:
        return self.alerts.get("immediate_trigger_statuses", ["Enacted"])

    @property
    def immediate_trigger_urgencies(self) -> List[str]:
        return self.alerts.get("immediate_trigger_urgencies", ["High", "Critical"])

    # ── Taxonomy ────────────────────────────────────────────
    @property
    def sectors(self) -> List[str]:
        return self._data.get("taxonomy", {}).get("sectors", [])

    @property
    def jurisdictions(self) -> List[str]:
        return self._data.get("taxonomy", {}).get("jurisdictions", [])

    # ── Policy Aliases ──────────────────────────────────────
    @property
    def policy_aliases(self) -> List[dict]:
        return self._data.get("policy_aliases", [])


@lru_cache()
def get_settings() -> Settings:
    return Settings()


# Singleton config instance (not cached — allows reload)
_app_config: Optional[AppConfig] = None


def get_config() -> AppConfig:
    global _app_config
    if _app_config is None:
        _app_config = AppConfig()
    return _app_config
