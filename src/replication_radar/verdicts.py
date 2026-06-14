"""The 'already-checked' layer: DOI -> Science Live replication verdicts.

This is the signal the OpenAIRE Graph structurally cannot hold (citation-popularity
is orthogonal to whether a claim held). Verdicts live in FORRT Outcome/CiTO nanopubs.

By default the index is built **live from the nanopub network** (author-agnostic,
network-wide; see network.py). If that fails (offline), it falls back to the bundled
data/verdicts.json. Set RADAR_VERDICTS_OFFLINE=1 to force the bundle.
"""
from __future__ import annotations

import json
import os
from functools import lru_cache
from importlib import resources


@lru_cache(maxsize=1)
def _bundled() -> dict[str, list[dict]]:
    with resources.files(__package__).joinpath("data/verdicts.json").open() as fh:
        return (json.load(fh).get("verifications")) or {}


@lru_cache(maxsize=1)
def _index() -> dict[str, list[dict]]:
    if os.environ.get("RADAR_VERDICTS_OFFLINE") != "1":
        try:
            from . import network
            live = network.build_index()
            if live:
                return live
        except Exception:  # noqa: BLE001 — any network/parse error → bundled fallback
            pass
    return _bundled()


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
