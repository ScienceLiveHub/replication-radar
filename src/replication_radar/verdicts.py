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


# Map a signed Outcome's validation status to one of three stances.
_CONFIRM = {"validated"}
_PARTIAL = {"partiallysupported"}
_CONTRA = {"contradicted"}


def _agreement(hits: list[dict]) -> dict:
    """How the independent verdicts agree, mirroring the web app's pattern logic.

    Deduplicates by signed Outcome nanopub (one stance per replication), then:
      refuted             — every verdict contradicts
      contested           — contradicted AND (confirmed or partial) — the interesting case
      robustly_validated  — >=2 confirmations, none contradicted, none partial
      validated           — at least one confirm/partial, none contradicted
    """
    seen: dict[str, str] = {}
    for v in hits:
        key = v.get("outcome_np") or id(v)
        if key not in seen:
            seen[key] = (v.get("verdict") or "").strip().lower()
    confirm = sum(1 for s in seen.values() if s in _CONFIRM)
    partial = sum(1 for s in seen.values() if s in _PARTIAL)
    contra = sum(1 for s in seen.values() if s in _CONTRA)
    n = len(seen)
    if contra and (confirm or partial):
        pattern = "contested"
    elif contra and not (confirm or partial):
        pattern = "refuted"
    elif confirm >= 2 and not partial:
        pattern = "robustly_validated"
    else:
        pattern = "validated"
    label = {
        "contested": "Contested — independent verdicts disagree",
        "refuted": "Refuted by independent replication",
        "robustly_validated": "Robustly validated — multiple confirmations, no disagreement",
        "validated": "Validated by independent replication",
    }[pattern]
    return {
        "pattern": pattern,
        "label": label,
        "confirmed": confirm,
        "partial": partial,
        "contradicted": contra,
        "independent_replications": n,
    }


def _claims(hits: list[dict]) -> list[dict]:
    """The distinct FORRT Claim(s) these Outcomes targeted — what exactly was replicated."""
    out: list[dict] = []
    seen: set[str] = set()
    for v in hits:
        c = v.get("claim") or {}
        aida = (c.get("aida") or "").strip()
        label = (c.get("label") or "").strip()
        if not (aida or label):
            continue
        key = aida or label
        if key in seen:
            continue
        seen.add(key)
        out.append({"statement": aida or label, "type": c.get("type") or "", "label": label})
    return out


def status_for(doi: str | None) -> dict:
    """Return the replication status for a DOI.

    {"replicated": bool, "verifications": [...], "summary": str,
     "agreement": {...}, "claims": [...]}
    """
    if not doi:
        return {"replicated": False, "verifications": [], "summary": "open",
                "agreement": None, "claims": []}
    hits = _index().get(doi.lower(), [])
    if not hits:
        return {"replicated": False, "verifications": [], "summary": "open",
                "agreement": None, "claims": []}
    verdicts = sorted({v["verdict"] for v in hits})
    agreement = _agreement(hits)
    return {
        "replicated": True,
        "verifications": hits,
        "summary": f"{len(hits)} verification(s): {', '.join(verdicts)}",
        "agreement": agreement,
        "claims": _claims(hits),
    }


def all_dois() -> set[str]:
    return set(_index().keys())
