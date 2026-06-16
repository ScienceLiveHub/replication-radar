"""Thin client over the OpenAIRE Graph API (graph/v1).

Hits api.openaire.eu directly (anonymous, no token needed for these queries).
Endpoint-agnostic: set RADAR_OPENAIRE_BASE to point at the Alien gateway or any
mirror later. Stdlib-only (urllib) so the core runs with zero install.

Operational rules learned from the connector spike (2026-06-13):
  - Free-text terms are AND-ed: keep queries SHORT (2-3 words), OR-expand if needed.
  - Rank SOFTWARE by reuse signal (repo + Software Heritage + usage), NOT citations
    (research software is almost uniformly citationClass C5 / 0 citations).
  - Rank PAPERS by citation impact (BIP! classes C1..C5 + count).
"""
from __future__ import annotations

import html
import json
import os
import re
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from typing import Any

BASE = os.environ.get("RADAR_OPENAIRE_BASE", "https://api.openaire.eu/graph/v1")
_TIMEOUT = float(os.environ.get("RADAR_HTTP_TIMEOUT", "30"))


def _abstract(rec: dict, limit: int = 2500) -> str:
    """The paper's abstract from OpenAIRE's `descriptions`, with JATS/HTML markup stripped.

    OpenAIRE returns abstracts wrapped in JATS XML (<jats:p>…</jats:p>); we strip tags,
    unescape entities and collapse whitespace so an agent (or the UI) gets clean prose it
    can read — e.g. to extract the paper's atomic claim as an AIDA statement.
    """
    descs = rec.get("descriptions") or []
    text = " ".join(d for d in descs if isinstance(d, str) and d.strip())
    if not text:
        return ""
    text = re.sub(r"<[^>]+>", " ", text)        # drop JATS/HTML tags
    text = html.unescape(text)
    text = re.sub(r"\s+", " ", text).strip()
    return text[:limit]

_CLASS_RANK = {"C1": 1, "C2": 2, "C3": 3, "C4": 4, "C5": 5, None: 9}


def _get(path: str, params: dict[str, Any]) -> dict:
    qs = urllib.parse.urlencode({k: v for k, v in params.items() if v is not None})
    url = f"{BASE}/{path}?{qs}"
    req = urllib.request.Request(url, headers={"Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
        return json.load(resp)


def _doi_of(rec: dict) -> str | None:
    for p in (rec.get("pids") or []):
        if (p.get("scheme") or "").lower() == "doi":
            return (p.get("value") or "").lower() or None
    for inst in (rec.get("instances") or []):
        for p in (inst.get("pids") or []):
            if (p.get("scheme") or "").lower() == "doi":
                return (p.get("value") or "").lower() or None
    return None


def _surnames(rec: dict) -> list[str]:
    out: list[str] = []
    for a in (rec.get("authors") or []):
        s = a.get("surname") or ""
        if not s and a.get("fullName"):
            # "Surname, Given" or "Given Surname" -> take the comma-lead or last token
            fn = a["fullName"]
            s = fn.split(",")[0].strip() if "," in fn else fn.split()[-1]
        s = s.strip().lower()
        if s:
            out.append(s)
    return out


def _year(rec: dict) -> int | None:
    d = rec.get("publicationDate") or ""
    return int(d[:4]) if d[:4].isdigit() else None


def _impact(rec: dict) -> dict:
    return ((rec.get("indicators") or {}).get("citationImpact")) or {}


def _urls(rec: dict) -> list[str]:
    out: list[str] = []
    for inst in (rec.get("instances") or []):
        out.extend(inst.get("urls") or [])
    if rec.get("codeRepositoryUrl"):
        out.append(rec["codeRepositoryUrl"])
    return out


@dataclass
class Product:
    doi: str | None
    title: str
    authors: list[str]          # lowercased surnames
    year: int | None
    type: str
    citation_count: int
    citation_class: str | None
    influence_class: str | None
    popularity_class: str | None
    impulse_class: str | None
    code_repo: str | None
    swh_archived: bool
    downloads: int
    abstract: str = ""
    raw_id: str | None = None

    @property
    def impact_rank(self) -> tuple[int, int, int]:
        # primary: best influence class, then citation class, then -count
        return (
            _CLASS_RANK.get(self.influence_class, 9),
            _CLASS_RANK.get(self.citation_class, 9),
            -self.citation_count,
        )

    @property
    def reuse_score(self) -> int:
        # for SOFTWARE: how reusable does this look?
        s = 0
        if self.code_repo:
            s += 2
        if self.swh_archived:
            s += 2
        if self.downloads > 0:
            s += 1
        if self.citation_count > 0:
            s += 1
        return s


def _to_product(rec: dict) -> Product:
    imp = _impact(rec)
    usage = ((rec.get("indicators") or {}).get("usageCounts")) or {}
    urls = _urls(rec)
    return Product(
        doi=_doi_of(rec),
        title=(rec.get("mainTitle") or "").strip(),
        authors=_surnames(rec),
        year=_year(rec),
        type=(rec.get("type") or "").lower(),
        citation_count=int(imp.get("citationCount") or 0),
        citation_class=imp.get("citationClass"),
        influence_class=imp.get("influenceClass"),
        popularity_class=imp.get("popularityClass"),
        impulse_class=imp.get("impulseClass"),
        code_repo=rec.get("codeRepositoryUrl"),
        swh_archived=any("softwareheritage.org" in (u or "") for u in urls),
        downloads=int(usage.get("downloads") or 0),
        abstract=_abstract(rec),
        raw_id=rec.get("id"),
    )


def search_products(topic: str, type_: str, size: int = 25, page: int = 1) -> list[Product]:
    """type_ in {publication, software, dataset, other}. Keep `topic` short."""
    data = _get(
        "researchProducts",
        {"search": topic, "type": type_, "pageSize": size, "page": page},
    )
    return [_to_product(r) for r in (data.get("results") or [])]


def get_by_doi(doi: str) -> Product | None:
    """Resolve a single product by DOI via the dedup id (md5 of the lowercased DOI)."""
    import hashlib

    h = hashlib.md5(doi.lower().encode()).hexdigest()
    try:
        data = _get("researchProducts", {"id": f"doi_dedup___::{h}", "pageSize": 1})
    except Exception:
        data = {}
    results = data.get("results") or []
    if results:
        return _to_product(results[0])
    # fallback: the DOI may be deduped with a preprint -> search by DOI string
    try:
        data = _get("researchProducts", {"search": doi, "pageSize": 5})
    except Exception:
        return None
    for r in data.get("results") or []:
        if _doi_of(r) == doi.lower():
            return _to_product(r)
    return None


@dataclass
class Funder:
    name: str
    jurisdiction: str | None
    funded_amount: float = 0.0


@dataclass
class ProjectLandscape:
    total: int
    funders: list[Funder] = field(default_factory=list)


def funder_landscape(topic: str, size: int = 20) -> ProjectLandscape:
    """Aggregate funder context for a field via /projects (per-paper funding is NOT
    reachable on this connector; this is topic-level CoARA context only)."""
    data = _get("projects", {"search": topic, "pageSize": size})
    total = (data.get("header") or {}).get("numFound") or len(data.get("results") or [])
    agg: dict[str, Funder] = {}
    for proj in data.get("results") or []:
        for f in proj.get("fundings") or []:
            name = f.get("name") or f.get("shortName") or "?"
            amt = float(((proj.get("granted") or {}).get("fundedAmount")) or 0)
            if name not in agg:
                agg[name] = Funder(name=name, jurisdiction=f.get("jurisdiction"))
            agg[name].funded_amount += amt
    funders = sorted(agg.values(), key=lambda x: -x.funded_amount)
    return ProjectLandscape(total=int(total), funders=funders)
