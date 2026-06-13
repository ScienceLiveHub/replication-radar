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
    find_independent_software as _find_software,
    replication_status as _replication_status,
)

mcp = FastMCP("replication-radar")


@mcp.tool()
def radar(topic: str, limit: int = 8) -> dict:
    """Impact-ranked replication targets in a research field.

    Returns high-impact OpenAIRE papers worth replicating, each flagged OPEN
    (opportunity) or VERIFIED (already checked by a Science Live replication, with
    the verdict), plus independent reusable tooling and a field funder-context panel.
    Keep `topic` short (2-3 words); OpenAIRE free-text terms are AND-ed.
    """
    return _radar(topic, limit=limit)


@mcp.tool()
def find_independent_software(doi: str = "", topic: str = "", limit: int = 8) -> dict:
    """Reusable method software for *replicating* a claim — engines NOT authored by
    the original paper's team (author-disjoint), ranked by reuse signal (code repo +
    Software Heritage archival + usage), not citations. Pass the original paper's DOI
    (authors are looked up) and a short topic."""
    return _find_software(doi=doi or None, topic=topic or None, limit=limit)


@mcp.tool()
def replication_status(doi: str) -> dict:
    """Has this DOI been independently replicated, and did it hold? Returns the
    Science Live verdict(s) (the reliability signal the OpenAIRE Graph cannot hold)
    with links to the CiTO nanopubs, or 'open' if not yet replicated."""
    return _replication_status(doi)


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
