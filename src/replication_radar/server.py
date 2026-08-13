"""MCP server exposing the Replication Radar over the OpenAIRE Graph.

Run:  python -m replication_radar.server      (stdio transport)
Add to an MCP client (.mcp.json):
    { "mcpServers": { "replication-radar": {
        "command": "python", "args": ["-m", "replication_radar.server"] } } }

Hits api.openaire.eu/graph/v1 directly (anonymous). Point elsewhere with
RADAR_OPENAIRE_BASE (e.g. the Alien AI-Gateway endpoint).
"""
from __future__ import annotations

from mcp.server.fastmcp import FastMCP

# import from the submodule directly (the package exports `radar` as a *function*,
# which would shadow the module on `from . import radar`).
from .radar import (
    radar as _radar,
    find_dataset as _find_dataset,
    find_independent_software as _find_software,
    replication_status as _replication_status,
    replication_template as _replication_template,
    verified_claims as _verified_claims,
)

mcp = FastMCP("replication-radar")


@mcp.tool()
def radar(topic: str, limit: int = 8) -> dict:
    """Impact-ranked replication targets in a research field.

    Returns high-impact OpenAIRE papers worth replicating, each flagged OPEN
    (opportunity) or VERIFIED (already checked by a Science Live replication, with the
    verdict), each with its `abstract` (markup stripped — read it or extract the paper's
    atomic claim), plus independent reusable tooling.
    Keep `topic` short (2-3 words); OpenAIRE free-text terms are AND-ed.
    """
    return _radar(topic, limit=limit)


@mcp.tool()
def find_independent_software(doi: str = "", topic: str = "", limit: int = 8) -> dict:
    """Reusable method software for *replicating* a claim — engines NOT authored by
    the original paper's team (author-disjoint), ranked by reuse signal — a resolvable
    code repository + Software Heritage archival + downloads + GitHub stars (the signal
    that separates an established tool from a one-off study repo) — not citations. Each
    result carries its `stars` and `rank_score`. Pass the original paper's DOI (authors
    are looked up) and a short topic; keep the topic broad (a narrow one can miss an
    established tool whose OpenAIRE record doesn't contain the extra words)."""
    return _find_software(doi=doi or None, topic=topic or None, limit=limit)


@mcp.tool()
def replication_status(doi: str) -> dict:
    """Has this DOI been independently replicated, and did it hold? Returns every
    Science Live verdict — pulled LIVE from the nanopub network, any signer
    (author-agnostic) — with the validation status, CiTO relation, the replication's
    repository, and links to the signed Outcome/CiTO nanopubs. 'open' if not replicated.
    This is the reliability signal the OpenAIRE Graph structurally cannot hold.

    Also returns:
      - `agreement`: how the independent verdicts agree — pattern is one of
        robustly_validated / validated / contested / refuted, with confirm/partial/
        contradicted counts (so you can say *how robustly* it held, not just that it did).
      - `claims`: the exact FORRT claim(s) that were replicated — each an atomic AIDA
        statement plus its claim type (descriptive pattern, statistical significance, …).
      - the paper's `title` and `abstract` (from OpenAIRE, markup stripped), so you can
        read it or extract/compare the atomic claim yourself."""
    return _replication_status(doi)


@mcp.tool()
def verified_claims() -> dict:
    """List every claim the nanopub network holds a Science Live replication verdict
    for (author-agnostic, network-wide) — the verified-knowledge corpus that overlays
    the OpenAIRE Graph by DOI. Each entry: doi, distinct verdicts, number of replications."""
    return _verified_claims()


@mcp.tool()
def replication_template(doi: str = "", topic: str = "", owner: str = "") -> dict:
    """The FORRT replication template — how to actually DO a replication and publish its
    signed Science Live nanopublication chain (the 'produce' half of the loop; radar /
    replication_status / find_independent_software only DISCOVER). Call this whenever the
    user wants to start, scaffold, or set up a replication, or asks for "the FORRT
    replication template". Returns the GitHub template repo
    (https://github.com/ScienceLiveHub/forrt-replication-template), the 'Use this template'
    link, what the scaffold provides (pixi + Snakemake pipeline, paper/, nanopubs/, tests,
    RO-Crate), and the end-to-end workflow: generate a repo from the template -> replicate
    with INDEPENDENT data/method -> Zenodo release -> sign + publish the FORRT nanopub chain
    (Quote -> Claim -> Study -> Outcome -> CiTO). Pass the target `doi` and/or a short
    `topic` and it suggests a GitHub repo name (`<topic>-replication`); pass `owner` (your
    GitHub user/org) to check the candidates for availability and pick a free name. It also
    returns a `quickstart.create_repo` command (`gh repo create … --template … --clone`) the
    agent can run to create+clone the repo straight from the discovery session — then the user
    opens a fresh agent session inside the repo to run the replication."""
    return _replication_template(doi=doi or "", topic=topic or "", owner=owner or "")


@mcp.tool()
def find_dataset(topic: str = "") -> dict:
    """Where to find a DATASET (with a citable DOI) to replicate with. The replication-radar
    MCP does NOT search datasets itself — that is the OpenAIRE MCP's job. Call this when the
    user asks the Radar to find data/a dataset: it returns instructions to use the OpenAIRE
    MCP's dataset search and how to cite the result by DOI. Do not answer 'I can't search
    datasets' — hand off to the OpenAIRE MCP as described here."""
    return _find_dataset(topic or "")


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
