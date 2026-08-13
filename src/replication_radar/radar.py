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

import re

from . import github, openaire, verdicts

# The scaffold that turns a discovered target into a real, cited, signed replication —
# the "produce" half of the loop the discovery tools only surface.
FORRT_TEMPLATE = "https://github.com/ScienceLiveHub/forrt-replication-template"
FORRT_TEMPLATE_SLUG = "ScienceLiveHub/forrt-replication-template"  # owner/repo, for `gh repo create --template`

# words dropped when slugging a title/topic into a repo name (kept: the content terms)
_SLUG_STOP = {"the", "a", "an", "and", "or", "of", "in", "on", "for", "to", "with", "from",
              "by", "at", "is", "are", "how", "over", "past", "more", "less", "longer",
              "shorter", "using", "study", "evidence", "global", "new", "century", "widespread"}


def _slug(text: str, max_words: int = 4) -> str:
    words = [w for w in re.sub(r"[^a-z0-9\s-]", " ", (text or "").lower()).split()
             if w and w not in _SLUG_STOP]
    return "-".join(words[:max_words]).strip("-")


def _suggest_repo_names(topic: str, paper) -> list[str]:
    """Repo-name candidates following the `<topic>-replication` kebab-case convention —
    several, so there's an alternative if the first is taken."""
    base = _slug(topic) or (_slug(paper.title) if paper else "")
    cands: list[str] = []
    if base:
        cands.append(f"{base}-replication")
    if paper and paper.authors and paper.year:
        cands.append(f"{re.sub(r'[^a-z0-9]', '', paper.authors[0].lower())}{paper.year}-replication")
    if base and paper and paper.year:
        cands.append(f"{base}-{paper.year}-replication")
    if base:
        cands += [f"{base}-replication-{i}" for i in (2, 3)]
    seen, out = set(), []
    for n in cands:
        if n and n not in seen:
            seen.add(n); out.append(n)
    return out or ["replication-study"]

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


_IMPACT_SORT = "influence DESC"  # fetch publications impact-first, not by OpenAIRE relevance


def _publication_pool(topic: str, size: int) -> list:
    """Robust pool: OpenAIRE free-text terms are AND-ed, so a long topic can return
    little. Query the full topic and (if thin) the most distinctive single term,
    then union and de-duplicate by DOI.

    Fetched impact-first (`_IMPACT_SORT`) so the pool is the field's high-impact papers —
    relevance order buries a field's most-cited paper past the fetch window (see
    `openaire.search_products`), which is what hid Oliver 2018 for "marine heatwave"."""
    pool = openaire.search_products(topic, "publication", size=size, sort_by=_IMPACT_SORT)
    terms = [t for t in topic.split() if len(t) > 3]
    if len(pool) < 5 and len(terms) > 1:
        longest = max(terms, key=len)
        pool += openaire.search_products(longest, "publication", size=size, sort_by=_IMPACT_SORT)
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


_SW_POOL = 100        # software candidates to fetch (established tools are often relevance-buried)
_RESOLVE_CAP = 40     # max GitHub/Zenodo lookups per call (cached; set GITHUB_TOKEN for headroom)


def _sw_rank_score(p, repo: str | None, stars: int | None) -> float:
    """Reuse score used to RANK software: the OpenAIRE signal plus a bounded GitHub-star bonus.
    Uses the resolved `repo` (so a Zenodo-linked tool OpenAIRE omitted still gets repo credit)."""
    s = 0.0
    if repo:                 s += 2   # a real, resolvable code repository
    if p.swh_archived:       s += 2   # Software Heritage archived
    if p.downloads > 0:      s += 1
    if p.citation_count > 0: s += 1
    return s + github.star_bonus(stars)   # stars separate established tools from one-off study repos


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

    # Wide pool: established tools are often relevance-buried in OpenAIRE's software index
    # (e.g. XMHW ranks ~60th for "marine heatwave"), so a small pool never sees them.
    pool = openaire.search_products(topic, "software", size=_SW_POOL)
    rows = []
    for p in pool:
        rows.append(
            {
                "title": p.title,
                "doi": p.doi,
                "authors": p.authors,
                "independent": _independence(original_authors, p.authors),
                "reuse_score": p.reuse_score,      # OpenAIRE-only signal (kept for transparency)
                "code_repo": p.code_repo,
                "swh_archived": p.swh_archived,
                "downloads": p.downloads,
                "stars": None,
                "_p": p,
            }
        )
    # Resolve GitHub stars for the independent candidates (bounded + cached, best-effort).
    # Stars are the missing reuse signal: without them a 0-star one-off study repo ranks like
    # an established, widely-used tool. Resolve highest OpenAIRE-signal first so the budget is
    # spent well; the Zenodo fallback recovers repos OpenAIRE omits (that is how XMHW resolves).
    resolvable = [
        r for r in rows
        if r["independent"] and (r["code_repo"] or "zenodo" in (r["doi"] or "").lower())
    ]
    resolvable.sort(key=lambda r: (-r["reuse_score"], -r["downloads"]))
    for r in resolvable[:_RESOLVE_CAP]:
        repo = github.resolve_repo(r["code_repo"], r["doi"])
        if repo:
            r["code_repo"] = repo
            r["stars"] = github.stars(repo)
    for r in rows:
        r["rank_score"] = round(_sw_rank_score(r.pop("_p"), r["code_repo"], r["stars"]), 2)
    # independent first, then real (stars-augmented) reuse, then downloads
    rows.sort(key=lambda r: (not r["independent"], -r["rank_score"], -r["downloads"]))
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
                "agreement": st["agreement"],
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
                    "agreement": st["agreement"],
                    "verifications": st["verifications"],
                }
            )

    land = openaire.funder_landscape(topic, size=20)
    return {
        "topic": topic,
        "targets": targets,
        "verified_in_field": verified_in_field,
        # how to ACT on an OPEN target — scaffold the replication + publish its signed chain
        "replicate_with": {
            "template_repo": FORRT_TEMPLATE,
            "tool": "replication_template",
            "note": "To replicate an OPEN target: create a repo from this FORRT template, replicate "
                    "with independent data/method, then sign + publish its Science Live nanopub chain "
                    "(call replication_template for the full workflow).",
        },
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


def replication_template(doi: str = "", topic: str = "", owner: str = "") -> dict:
    """The FORRT replication template — the scaffold to actually DO a replication and
    publish its signed Science Live nanopublication chain (the 'produce' half of the loop
    that radar / replication_status / find_independent_software only discover).

    Pass the target `doi` and/or a short `topic` and it suggests a GitHub repo name from the
    paper (`<topic>-replication`). Pass `owner` (a GitHub user/org) to check the candidates
    for availability and pick a free one — so you can rename if the name already exists."""
    paper = openaire.get_by_doi(doi) if doi else None
    workflow = [
        f"Create your own repo from the template — 'Use this template' at {FORRT_TEMPLATE}/generate "
        "(it is a GitHub template repository).",
        "Add the paper you are replicating (paper/) and set the target.",
        "Find the data — use the OpenAIRE MCP (search_research_products, type=dataset) for a citable "
        "dataset DOI; replication-radar does not search datasets itself. Independent data strengthens it.",
        "Replicate: reproduce the paper's claim with INDEPENDENT data and/or method (replication, "
        "not just re-running the original code). pixi gives the environment; the Snakefile runs the "
        "reproducible pipeline (figure + verdict).",
        "AI-guided: CLAUDE.md / AGENTS.md drive an agent through the scaffold, the run, and drafting "
        "the FORRT nanopublication chain (Quote -> Claim -> Study -> Outcome -> CiTO).",
        "Release: archive to Zenodo (RO-Crate + codemeta + CITATION.cff included) and SIGN + publish "
        "the nanopublication chain to Science Live.",
        "The loop closes: once published, replication_status(doi) and the Radar's verdict overlay "
        "surface your verdict network-wide, author-agnostic.",
    ]
    out = {
        "template_repo": FORRT_TEMPLATE,
        "use_this_template": f"{FORRT_TEMPLATE}/generate",
        "is_github_template": True,
        "what": "Self-contained scaffold for FORRT replication studies — paper PDF in, "
                "Zenodo-archived release + Science Live nanopublication chain out; AI-guided "
                "via CLAUDE.md / AGENTS.md.",
        "provides": ["pixi environment", "Snakefile pipeline", "notebooks/", "paper/",
                     "nanopubs/ (FORRT chain templates)", "scripts/ (chain & story draft builders)",
                     "tests", "RO-Crate + codemeta + CITATION.cff", "Dockerfile"],
        "workflow": workflow,
        "use_after": "radar() / replication_status() — this turns a discovered, un-replicated "
                     "target into a real, cited, signed replication.",
    }
    if doi or topic:
        candidates = _suggest_repo_names(topic, paper)
        out["repo_naming_convention"] = "<topic>-replication (kebab-case) — you can rename freely"
        if owner:
            # exists: True = taken, False = available, None = unknown (rate-limited/error)
            checked = [{"name": n, "exists": github.repo_exists(owner, n)} for n in candidates]
            free = [c["name"] for c in checked if c["exists"] is False]
            out["suggested_repo_name"] = free[0] if free else candidates[0]
            out["repo_name_candidates"] = checked
            out["checked_owner"] = owner
            out["repo_name_note"] = (
                "Picked the first name that is free under this owner; candidates with exists=true are "
                "taken. Change it to any free name you like." if free else
                "All candidates are taken or availability is unknown — choose another name "
                "(append a suffix, or use the author-year form)."
            )
        else:
            out["suggested_repo_name"] = candidates[0]
            out["suggested_repo_name_alternatives"] = candidates[1:]
            out["repo_name_note"] = "Pass `owner` (your GitHub user/org) to auto-check availability and skip taken names."
        name = out["suggested_repo_name"]
        out["quickstart"] = {
            "create_repo": f"gh repo create {name} --template {FORRT_TEMPLATE_SLUG} --public --clone && cd {name}",
            "private_variant": f"gh repo create {name} --template {FORRT_TEMPLATE_SLUG} --private --clone && cd {name}",
            "then": (
                "The agent can run `create_repo` from the discovery session to create + clone the repo. THEN "
                f"open a FRESH agent session INSIDE it (`cd {name} && claude`) to run the replication: Claude "
                "Code loads a project's CLAUDE.md/AGENTS.md, slash commands and .mcp.json only at session START, "
                "not on a mid-session cd — so discovery ends at repo creation, and the replication runs in a "
                "session rooted in the new repo (where the template's manual + /init-template are available)."
            ),
        }
    if doi:
        out["target_doi"] = doi
    if paper:
        out["target_title"] = paper.title
    return out


def find_dataset(topic: str = "") -> dict:
    """The replication-radar MCP does not search datasets — that is the OpenAIRE MCP's role.
    Returns a hand-off telling the agent how to find a citable dataset there (so it should
    NOT answer 'I can't search datasets')."""
    q = topic or "<topic>"
    return {
        "handled_by": "openaire (the OpenAIRE MCP)",
        "why": "replication-radar covers papers (radar), replication verdicts (replication_status) "
               "and reusable software (find_independent_software). DATASETS are the OpenAIRE MCP's "
               "job — use it directly instead of saying you can't search datasets.",
        "how": f'Call the OpenAIRE MCP: search_research_products(query="{q}", type=["dataset"]) — it '
               "returns datasets with citable DOIs. Prefer this over find_datasets_by_topic (sparse, "
               "usually 0).",
        "then": "Cite the chosen dataset by its DOI in the replication (data/ + the FORRT chain). "
                "Independent data from the original paper strengthens the replication.",
        "example": "topic 'ERA5' -> C3S ERA5 dataset DOI 10.24381/cds.adbb2d47 (the data our "
                   "marine-heatwave example uses).",
    }
