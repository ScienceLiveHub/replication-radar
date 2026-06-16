"""Core Replication Radar logic — pure functions over the OpenAIRE client + verdicts.

Three capabilities (exposed as MCP tools in server.py):
  - radar(topic)                  : impact-ranked replication targets in a field,
                                    each flagged open vs already-verified, with a
                                    field-level funder-context panel.
  - find_independent_software(doi): reusable engines NOT authored by the original team
                                    (the reproduction-vs-replication distinction, made
                                    computable as author-disjointness).
  - replication_status(doi)       : Science Live verdict overlay for one DOI.
"""
from __future__ import annotations

from . import openaire, verdicts

# impact class -> 0..1 (C1 best). Used in the readiness score.
_CLASS_SCORE = {"C1": 1.0, "C2": 0.8, "C3": 0.6, "C4": 0.4, "C5": 0.2, None: 0.2}


def _impact_score(p) -> float:
    return max(_CLASS_SCORE.get(p.influence_class, 0.2), _CLASS_SCORE.get(p.citation_class, 0.2))


def _readiness(impact: float, has_independent_tool: bool, has_data: bool) -> float:
    """Transparent 0..1 'replication-readiness' for an OPEN target:
    how impactful (so worth checking) AND feasible (independent tooling + data exist).
        0.5 * impact  +  0.3 * independent-tooling  +  0.2 * reference-data
    """
    return round(0.5 * impact + 0.3 * bool(has_independent_tool) + 0.2 * bool(has_data), 2)


def _dedup_by_doi(products: list) -> list:
    seen, out = set(), []
    for p in products:
        key = p.doi or p.title.lower()
        if key not in seen:
            seen.add(key)
            out.append(p)
    return out


def _publication_pool(topic: str, size: int) -> list:
    """Robust pool: OpenAIRE free-text terms are AND-ed, so a long topic can return
    little. Query the full topic and (if thin) the most distinctive single term,
    then union and de-duplicate by DOI."""
    pool = openaire.search_products(topic, "publication", size=size)
    terms = [t for t in topic.split() if len(t) > 3]
    if len(pool) < 5 and len(terms) > 1:
        longest = max(terms, key=len)
        pool += openaire.search_products(longest, "publication", size=size)
    return _dedup_by_doi(pool)


def _independence(target_authors: list[str], cand_authors: list[str]) -> bool:
    """A candidate tool is INDEPENDENT of the target paper if no author surname is
    shared. This is what makes a *replication* (different toolchain) rather than a
    *reproduction* (the original team's code)."""
    if not cand_authors:
        return True  # unattributed engine (e.g. a package repo) — treat as independent
    return not (set(target_authors) & set(cand_authors))


def replication_status(doi: str) -> dict:
    st = verdicts.status_for(doi)
    paper = openaire.get_by_doi(doi)   # for the title + abstract (an agent can extract the claim)
    return {
        "doi": doi.lower(),
        "title": paper.title if paper else None,
        "abstract": paper.abstract if paper else "",
        **st,
    }


def verified_claims() -> dict:
    """Every claim the nanopub network has a Science Live verdict for (author-agnostic).
    The verified-knowledge corpus the OpenAIRE Graph can't hold."""
    idx = verdicts._index()
    claims = [
        {"doi": d, "verdicts": sorted({v["verdict"] for v in vs}), "replications": len(vs)}
        for d, vs in sorted(idx.items(), key=lambda kv: -len(kv[1]))
    ]
    return {"count": len(claims), "claims": claims}


def find_independent_software(
    doi: str | None = None,
    topic: str | None = None,
    original_authors: list[str] | None = None,
    limit: int = 8,
) -> dict:
    """Find reusable, INDEPENDENT method software for replicating a claim.

    Provide a DOI (authors are looked up) or pass original_authors directly, plus a
    short `topic` to search the software pool. Ranks by reuse signal, not citations.
    """
    paper = None
    if original_authors is None and doi:
        paper = openaire.get_by_doi(doi)
        original_authors = paper.authors if paper else []
    original_authors = original_authors or []
    if not topic:
        # derive a short topic from the title's leading words
        topic = " ".join((paper.title if paper else "").split()[:3]) or "software"

    pool = openaire.search_products(topic, "software", size=25)
    rows = []
    for p in pool:
        rows.append(
            {
                "title": p.title,
                "doi": p.doi,
                "authors": p.authors,
                "independent": _independence(original_authors, p.authors),
                "reuse_score": p.reuse_score,
                "code_repo": p.code_repo,
                "swh_archived": p.swh_archived,
                "downloads": p.downloads,
            }
        )
    # independent first, then most-reusable
    rows.sort(key=lambda r: (not r["independent"], -r["reuse_score"]))
    return {
        "query_topic": topic,
        "original_authors": original_authors,
        "independent_count": sum(1 for r in rows if r["independent"]),
        "software": rows[:limit],
    }


def radar(topic: str, limit: int = 8, pool: int = 30) -> dict:
    """Impact-ranked replication targets in a field.

    Each target is flagged open vs already-verified (Science Live overlay) and, for
    open high-impact targets, whether independent tooling exists in the field.
    """
    papers = _publication_pool(topic, size=pool)
    papers.sort(key=lambda p: p.impact_rank)

    # one software pull + one dataset pull for the field; reused across targets
    sw_pool = openaire.search_products(topic, "software", size=25)
    has_data = len(openaire.search_products(topic, "dataset", size=5)) > 0

    targets = []
    for p in papers[:limit]:
        st = verdicts.status_for(p.doi)
        indep_tools = [
            s for s in sw_pool if _independence(p.authors, s.authors) and s.reuse_score >= 2
        ]
        indep_tools.sort(key=lambda s: -s.reuse_score)
        open_target = not st["replicated"]
        targets.append(
            {
                "title": p.title,
                "doi": p.doi,
                "year": p.year,
                "abstract": p.abstract,
                "citations": p.citation_count,
                "impact": {
                    "citationClass": p.citation_class,
                    "influenceClass": p.influence_class,
                    "popularityClass": p.popularity_class,
                },
                "status": "OPEN" if open_target else "VERIFIED",
                # replication-readiness only meaningful for OPEN targets (VERIFIED = already done)
                "readiness": _readiness(_impact_score(p), bool(indep_tools), has_data) if open_target else None,
                "verification": st["summary"],
                "verifications": st["verifications"],
                "independent_tooling": [
                    {"title": s.title, "code_repo": s.code_repo, "swh": s.swh_archived}
                    for s in indep_tools[:3]
                ],
            }
        )
    # rank OPEN targets by readiness (most replicable first); VERIFIED sink below
    targets.sort(key=lambda t: (t["status"] != "OPEN", -(t["readiness"] or 0)))

    # Guarantee the verified-overlay shows: don't rely on keyword retrieval to
    # surface already-checked papers. Pull the verdict index directly and include
    # any whose title is topically relevant (shares a significant token).
    shown = {t["doi"] for t in targets}
    topic_terms = {w.lower() for w in topic.split() if len(w) > 3}
    verified_in_field = []
    for vdoi in sorted(verdicts.all_dois()):
        if vdoi in shown:
            continue
        p = openaire.get_by_doi(vdoi)
        if not p:
            continue
        title_terms = {w.lower().strip(",.:") for w in p.title.split()}
        if topic_terms & title_terms:
            st = verdicts.status_for(vdoi)
            verified_in_field.append(
                {
                    "title": p.title,
                    "doi": vdoi,
                    "citations": p.citation_count,
                    "impact": {"citationClass": p.citation_class, "influenceClass": p.influence_class},
                    "status": "VERIFIED",
                    "verification": st["summary"],
                    "verifications": st["verifications"],
                }
            )

    land = openaire.funder_landscape(topic, size=20)
    return {
        "topic": topic,
        "targets": targets,
        "verified_in_field": verified_in_field,
        "open_count": sum(1 for t in targets if t["status"] == "OPEN"),
        "verified_count": sum(1 for t in targets if t["status"] == "VERIFIED") + len(verified_in_field),
        "funder_context": {
            "projects_in_field": land.total,
            "top_funders": [
                {"name": f.name, "jurisdiction": f.jurisdiction, "funded_eur": round(f.funded_amount)}
                for f in land.funders[:5]
            ],
        },
    }
