"""The 'already-checked' memory layer: DOI -> Science Live replication verdicts.

This is the signal the OpenAIRE Graph structurally cannot hold (citation-popularity
is orthogonal to whether a claim held). Verdicts live in CiTO nanopubs; this index
is the bundled crosswalk. Extend data/verdicts.json as new chains are published.
"""
from __future__ import annotations

import json
from functools import lru_cache
from importlib import resources


@lru_cache(maxsize=1)
def _index() -> dict[str, list[dict]]:
    with resources.files(__package__).joinpath("data/verdicts.json").open() as fh:
        return (json.load(fh).get("verifications")) or {}


def status_for(doi: str | None) -> dict:
    """Return the replication status for a DOI.

    {"replicated": bool, "verifications": [...], "summary": str}
    """
    if not doi:
        return {"replicated": False, "verifications": [], "summary": "open"}
    hits = _index().get(doi.lower(), [])
    if not hits:
        return {"replicated": False, "verifications": [], "summary": "open"}
    verdicts = sorted({v["verdict"] for v in hits})
    return {
        "replicated": True,
        "verifications": hits,
        "summary": f"{len(hits)} verification(s): {', '.join(verdicts)}",
    }


def all_dois() -> set[str]:
    return set(_index().keys())
