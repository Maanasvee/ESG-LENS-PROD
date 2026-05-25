"""
ESG Lens — ChromaDB Service
Self-hosted vector store for semantic policy search.
Runs in persistent local mode on Railway (upgradeable to ChromaDB Cloud).
"""

import logging
import uuid
from typing import List, Optional

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.config import get_settings

logger = logging.getLogger(__name__)
settings = get_settings()

COLLECTION_NAME = "esg_policies"

_client: Optional[chromadb.PersistentClient] = None
_collection = None


def _get_client() -> chromadb.PersistentClient:
    global _client
    if _client is None:
        _client = chromadb.PersistentClient(
            path=settings.chroma_persist_dir,
            settings=ChromaSettings(anonymized_telemetry=False),
        )
        logger.info(f"ChromaDB client initialized at: {settings.chroma_persist_dir}")
    return _client


def get_collection():
    global _collection
    if _collection is None:
        client = _get_client()
        _collection = client.get_or_create_collection(
            name=COLLECTION_NAME,
            metadata={"hnsw:space": "cosine"},
        )
        logger.info(f"ChromaDB collection '{COLLECTION_NAME}' ready. Count: {_collection.count()}")
    return _collection


async def store_policy_embedding(
    *,
    policy_id: int,
    text: str,
    embedding: list,
    metadata: Optional[dict] = None,
) -> str:
    """
    Stores a policy's embedding in ChromaDB.
    Returns the ChromaDB document ID.
    """
    collection = get_collection()
    chroma_id = f"policy_{policy_id}"

    doc_metadata = {
        "policy_id": str(policy_id),
        "pillar": metadata.get("pillar", "") if metadata else "",
        "jurisdiction": metadata.get("jurisdiction", "") if metadata else "",
        "urgency": metadata.get("urgency", "") if metadata else "",
        "review_status": "verified",
    }

    collection.upsert(
        ids=[chroma_id],
        embeddings=[embedding],
        documents=[text],
        metadatas=[doc_metadata],
    )
    logger.debug(f"Stored embedding for policy {policy_id}")
    return chroma_id


async def search_policies(
    *,
    query_embedding: list,
    n_results: int = 10,
    filter_dict: Optional[dict] = None,
) -> List[dict]:
    """
    Semantic search over verified policies.
    Returns list of dicts with policy_id, document, distance.
    """
    collection = get_collection()

    where = {"review_status": "verified"}
    if filter_dict:
        where.update(filter_dict)

    results = collection.query(
        query_embeddings=[query_embedding],
        n_results=min(n_results, collection.count() or 1),
        where=where,
        include=["documents", "metadatas", "distances"],
    )

    hits = []
    if results and results["ids"] and results["ids"][0]:
        for i, doc_id in enumerate(results["ids"][0]):
            hits.append({
                "chroma_id": doc_id,
                "policy_id": int(results["metadatas"][0][i].get("policy_id", 0)),
                "document": results["documents"][0][i],
                "distance": results["distances"][0][i],
                "similarity": 1 - results["distances"][0][i],
            })

    return hits


async def delete_policy_embedding(policy_id: int) -> None:
    """Removes a policy embedding from ChromaDB (e.g., on rejection)."""
    collection = get_collection()
    try:
        collection.delete(ids=[f"policy_{policy_id}"])
        logger.debug(f"Deleted embedding for policy {policy_id}")
    except Exception as e:
        logger.warning(f"Could not delete embedding for policy {policy_id}: {e}")
