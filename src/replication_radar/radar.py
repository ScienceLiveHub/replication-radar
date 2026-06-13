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


def _independence(target_authors: list[str], cand_authors: list[str]) -> bool:
    """A candidate tool is INDEPENDENT of the target paper if no author surname is
    shared. This is what makes a *replication* (different toolchain) rather than a
    *reproduction* (the original team's code)."""
    if not cand_authors:
        return True  # unattributed engine (e.g. a package repo) — treat as independent
    return not (set(target_authors) & set(cand_authors))


def replication_status(doi: str) -> dict:
    st = verdicts.status_for(doi)
    return {"doi": doi.lower(), **st}


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
    papers = openaire.search_products(topic, "publication", size=pool)
    papers.sort(key=lambda p: p.impact_rank)

    # one software pull for the field; independence is computed per target
    sw_pool = openaire.search_products(topic, "software", size=25)

    targets = []
    for p in papers[:limit]:
        st = verdicts.status_for(p.doi)
        indep_tools = [
            s for s in sw_pool if _independence(p.authors, s.authors) and s.reuse_score >= 2
        ]
        indep_tools.sort(key=lambda s: -s.reuse_score)
        targets.append(
            {
                "title": p.title,
                "doi": p.doi,
                "year": p.year,
                "citations": p.citation_count,
                "impact": {
                    "citationClass": p.citation_class,
                    "influenceClass": p.influence_class,
                    "popularityClass": p.popularity_class,
                },
                "status": "VERIFIED" if st["replicated"] else "OPEN",
                "verification": st["summary"],
                "verifications": st["verifications"],
                "independent_tooling": [
                    {"title": s.title, "code_repo": s.code_repo, "swh": s.swh_archived}
                    for s in indep_tools[:3]
                ],
            }
        )

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
