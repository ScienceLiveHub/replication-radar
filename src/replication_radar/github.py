"""GitHub + Zenodo helpers so reusable-software ranking reflects real reuse (stars),
not just OpenAIRE metadata.

Why: OpenAIRE's software records are uniformly low-citation and often omit the code
repository URL, so a one-off study repo can look as "reusable" as an established tool.
GitHub stars are the missing signal — the web app already ranks its software lens with
them; this brings the MCP in line.

Resolution mirrors the web app: prefer OpenAIRE's codeRepositoryUrl, else the Zenodo
record's related_identifiers (many Zenodo-published tools omit the repo URL in OpenAIRE —
e.g. XMHW). Stars come from the GitHub REST API (unauth 60/hr; set GITHUB_TOKEN to lift to
5000/hr). Every lookup is cached and BEST-EFFORT — a failed/rate-limited call returns None
and the caller falls back to the OpenAIRE-only signal, so results stay grounded and never
crash. Stdlib only.
"""
from __future__ import annotations

import json
import math
import os
import re
import urllib.request

_TIMEOUT = float(os.environ.get("RADAR_HTTP_TIMEOUT", "30"))
_TOKEN = os.environ.get("GITHUB_TOKEN") or os.environ.get("RADAR_GITHUB_TOKEN")
_stars_cache: dict[str, int | None] = {}
_zenodo_repo_cache: dict[str, str | None] = {}


def _parse(url: str | None) -> tuple[str, str] | None:
    m = re.search(r"github\.com/([^/]+)/([^/#?]+)", url or "", re.I)
    return (m.group(1), m.group(2).replace(".git", "")) if m else None


def _get_json(url: str, headers: dict) -> dict | None:
    try:
        req = urllib.request.Request(url, headers=headers)
        with urllib.request.urlopen(req, timeout=_TIMEOUT) as r:
            return json.load(r)
    except Exception:
        return None


def _github_from_zenodo(doi: str | None) -> str | None:
    m = re.search(r"zenodo\.(\d+)", doi or "", re.I)
    if not m:
        return None
    key = m.group(1)
    if key in _zenodo_repo_cache:
        return _zenodo_repo_cache[key]
    found = None
    d = _get_json(
        f"https://zenodo.org/api/records/{key}",
        {"Accept": "application/json", "User-Agent": "replication-radar"},
    )
    for rel in ((d or {}).get("metadata") or {}).get("related_identifiers") or []:
        ident = rel.get("identifier") or ""
        if "github.com" in ident:
            found = ident
            break
    _zenodo_repo_cache[key] = found
    return found


def resolve_repo(code_repo: str | None, doi: str | None = None) -> str | None:
    """Normalised ``https://github.com/owner/repo`` for this software, or None.

    Prefers OpenAIRE's ``codeRepositoryUrl``; falls back to the Zenodo record's
    ``related_identifiers`` (many Zenodo-published tools omit the repo URL in OpenAIRE)."""
    g = _parse(code_repo) or _parse(_github_from_zenodo(doi))
    return f"https://github.com/{g[0]}/{g[1]}" if g else None


def stars(repo_url: str | None) -> int | None:
    """GitHub stargazers for a repo URL (cached); None if unknown/unreachable/rate-limited.

    Set ``GITHUB_TOKEN`` (or ``RADAR_GITHUB_TOKEN``) to lift the 60/hr unauth limit to 5000/hr."""
    g = _parse(repo_url)
    if not g:
        return None
    key = f"{g[0]}/{g[1]}".lower()
    if key in _stars_cache:
        return _stars_cache[key]
    headers = {"Accept": "application/vnd.github+json", "User-Agent": "replication-radar"}
    if _TOKEN:
        headers["Authorization"] = f"Bearer {_TOKEN}"
    d = _get_json(f"https://api.github.com/repos/{g[0]}/{g[1]}", headers)
    val = int(d["stargazers_count"]) if d and "stargazers_count" in d else None
    _stars_cache[key] = val
    return val


def star_bonus(n: int | None) -> float:
    """Bounded log-scale star contribution to a reuse score, mirroring the web app
    (``min(3, log10(stars+1) * 1.6)``): 0 stars → 0; ~10 → 1.7; ~30 → 2.4; ≥250 → 3.0."""
    if not n or n <= 0:
        return 0.0
    return min(3.0, math.log10(n + 1) * 1.6)
