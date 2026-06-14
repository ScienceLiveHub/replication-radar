# Replication Radar

### 🔗 Live demo → **https://openaire-hackathon.netlify.app**

A tool that **makes the OpenAIRE Graph more useful for replication.** Search a research
field and it answers the question the Graph structurally cannot: *what high-impact work
is worth replicating, has it already been independently checked — with what verdict — and
is the software reusable?*

Ships as a **live web app** (the link above — pure static, queries OpenAIRE + the nanopub
network + GitHub/Software Heritage from the browser) **and** an **MCP server** (this package)
that exposes the same engine to any agent. Built for the OpenAIRE AI Hackathon (Theme B), CC-BY.

OpenAIRE's only value signal is citation-popularity (BIP! influence / popularity /
impulse, classes C1–C5) — paper-bound, and orthogonal to whether a claim is *true*.
The Radar joins three sources to add a **replication layer** on top:

- **OpenAIRE Graph** — impact-ranks candidate papers (`api.openaire.eu/graph/v1`).
- **Software Heritage + repo signals** — surfaces *reusable* method software.
- **Science Live nanopub verdicts** — the "already checked → did it hold" overlay.

> OpenAIRE AI Hackathon · Theme B (Build) · CC-BY. Built to be reused through the
> [forrt-replication-template](https://github.com/ScienceLiveHub/forrt-replication-template):
> discovery at the *start* of a replication, where the template's existing skills
> handle the nanopub chain at the *end*.

## Tools

| Tool | What it answers |
|---|---|
| `radar(topic)` | Impact-ranked replication targets in a field — each **OPEN** (opportunity) or **VERIFIED** (done, with verdict) + independent tooling + funder context |
| `find_independent_software(doi, topic)` | Reusable engines **not authored by the original team** (author-disjoint = *replication*, not *reproduction*), ranked by reuse signal not citations |
| `replication_status(doi)` | Has this DOI been replicated, did it hold? Verdict(s) — **live from the nanopub network, any signer** — with status, CiTO relation, repo, and signed Outcome/CiTO nanopub links; `open` if not |
| `verified_claims()` | The whole **verified-knowledge corpus** — every claim the network holds a verdict for (author-agnostic) |

The verdict tools pull **live** from the nanopub network (the FORRT Outcome/CiTO templates on
`query.knowledgepixels.com`); the bundled `verdicts.json` is an offline fallback. So the MCP is the
**verified-knowledge layer** — pair it with the OpenAIRE MCP and an agent has both the structural
Graph *and* "has this been checked, and did it hold".

### The reproduction-vs-replication distinction, made computable
A *reproduction* re-runs the original code; a *replication* tests the same claim by a
**different** route. So the Radar filters tooling by **author-disjointness** from the
original paper — e.g. for Phillips et al. 2009, the `dismo` package (co-authored by
Phillips & Elith) is flagged *rooted* / non-independent, while `biomod2` and `jSDM`
are *independent*. That filter is the difference between the two, and it's the thing
that makes this replication-aware rather than just "find the code".

## Run

```bash
pip install -e .                       # installs the `mcp` runtime
python -m replication_radar.server     # stdio MCP server
```

Add to an MCP client (`.mcp.json`):

```json
{ "mcpServers": {
  "replication-radar": { "command": "python", "args": ["-m", "replication_radar.server"] }
} }
```

The **core** (OpenAIRE client + radar logic) is stdlib-only — try it without the MCP
runtime:

```bash
PYTHONPATH=src python3 demo_sdm.py     # live vertical-slice demo on SDM
```

## Configuration

| Env var | Default | Purpose |
|---|---|---|
| `RADAR_OPENAIRE_BASE` | `https://api.openaire.eu/graph/v1` | Swap to the Alien AI-Gateway or a mirror — the Radar is endpoint-agnostic |
| `RADAR_HTTP_TIMEOUT` | `30` | Per-request timeout (s) |

## Known limits (v1, honest)
- **Keyword-bound discovery.** OpenAIRE free-text terms are AND-ed; long queries
  return nothing. Use short topics. The VERIFIED overlay is *guaranteed* (resolved
  from the verdict index directly), but OPEN-target recall depends on the query.
- **No graph-relation traversal** on the public API (paper→its software/data/grant
  edges aren't exposed): tooling/data are matched heuristically by topic + author
  independence, not by a hard relation. Upgrades cleanly if a gateway exposes relations.
- **Funder context is field-level, not per-paper** (per-paper funder attribution is
  not reachable); budgets are frequently reported as 0 in records.
- The verdict index ships 6 source works / 12 chains (Science Live). Extend
  `data/verdicts.json` to grow coverage.
```
