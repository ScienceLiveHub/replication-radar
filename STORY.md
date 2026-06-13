# Replication Radar — making the OpenAIRE Graph tell you what to replicate

*OpenAIRE AI Hackathon · Theme B (Build) · a Science Live contribution*

## The question

The OpenAIRE Graph knows how *visible* a paper is — citation influence, popularity,
impulse, the BIP! classes C1–C5. It does not, and structurally cannot, know whether a
paper's claim is *true*. Citation-popularity is a measure of attention, and attention
is orthogonal to reliability: a heavily-cited result looks identical, in the Graph, to
one nobody ever checked.

So we asked a build question, not a metrics question: **can we add the one signal the
Graph can't hold — has this claim been independently replicated, and did it hold — and
in doing so turn the Graph from a record of what *was* done into a tool that tells you
what's worth replicating *next*?**

## The journey

We started narrow: Science Live already has 30+ FORRT replication chains, each ending
in a cryptographically-signed nanopub that records a verdict (Validated, Partially
Supported, …). The first idea was a lookup — "is this DOI verified?" — joined to the
Graph by DOI. It worked, but it was **sparse**: it lights up only on the dozen papers
we happen to have replicated, and answers "no data" everywhere else. A tool that's
empty 99.99% of the time isn't a tool.

The turn came from a distinction that matters in replication science but is usually
left implicit. A **reproduction** re-runs the original code; a **replication** tests
the same claim by a *different* route. The right question for a research engineer isn't
"where's the paper's code" — it's "is there *independent* tooling I could use to check
this?" That reframing pointed at the whole Graph, not our twelve chains: the Graph
already records which results are high-impact, which have **reusable open software**,
and which have **open data** — it just never joins them into a "this is worth, and
feasible, to replicate" signal.

We spiked feasibility against the live OpenAIRE Graph API before building, and reported
honestly what works and what doesn't:

- **Impact ranking** — works (`citationImpact`, C1–C5, on papers and software).
- **Independent tooling** — works, and the reproduction-vs-replication line turns out
  to be *computable*: for Phillips et al. 2009 (2,441 citations, C1), the `dismo`
  package is flagged *non-independent* because Phillips and Elith co-author it, while
  `biomod2` (Software-Heritage-archived) and `jSDM` are independent. Author-disjointness
  is the filter that makes the tool replication-aware.
- **Reuse ranking** — research software is almost uniformly C5/0 citations, so we rank
  *software* by reuse signal (code repo + Software Heritage archival + usage), not by
  citations.
- **Reference data** — abundant (1,228 occurrence datasets for one query).
- **Funder context** — only *field-level* (per-paper funder attribution and graph-edge
  traversal aren't exposed on the public API). We kept what works and dropped what
  doesn't, rather than fake it.

Then we built it, proved it live on Species Distribution Models, and wired it into the
public `forrt-replication-template` so every new replication repo gets discovery built in.

## The insight

Three things we didn't expect going in:

1. **Reliability is a different *category* of signal, not a better metric.** The Graph's
   citation axis can't be repaired into a truth axis; verification has to be *added*,
   and it applies to any claim — including paperless ones the Graph never indexes.
2. **The reproduction/replication distinction is operational.** "Independent of the
   original authors" is a concrete, computable filter — and it's the thing that turns
   "find the code" into "find a way to *check* this."
3. **The Graph already holds the ingredients of a replication-readiness signal** (impact
   + reusable software + data) and simply doesn't join them. Joining them is most of the
   value.

## What others can reuse

- **`replication-radar`** — an MCP server (`pip install` / `uvx`, MIT) exposing three
  tools any agent can add next to the OpenAIRE MCP: `radar(topic)` (impact-ranked
  replication targets, each OPEN or already-VERIFIED, with independent tooling + funder
  context), `find_independent_software(doi)` (author-disjoint reusable engines), and
  `replication_status(doi)` (the verdict overlay). It hits the public OpenAIRE Graph API
  anonymously and is endpoint-agnostic (`RADAR_OPENAIRE_BASE`) so it points at the Alien
  gateway or any mirror. Repo: https://github.com/ScienceLiveHub/replication-radar
- **The verdict-index format** (`data/verdicts.json`) — a portable DOI→verdict crosswalk
  others can extend with their own replications.
- **The template integration** — a `/radar` discovery skill that drops into any
  fork of `forrt-replication-template`.
- **The connector feasibility map** — a documented account of what the OpenAIRE MCP /
  Graph API can and can't do for replication tooling, so the next builder doesn't
  re-discover it.

## Honest limits

Discovery recall is keyword-bound (OpenAIRE free-text terms are AND-ed); the verified
overlay is authoritative but reflects a known index, not every replication that exists;
tooling is matched by topic + author-independence, not a proven ability to test a
specific claim — the tool surfaces and ranks, the researcher judges. None of these are
hidden in the output.

---

*Materials in this repository are dual-licensed: **source code under MIT**, and this
write-up together with the verdict index (`STORY.md`, `data/verdicts.json`) under
**[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.*
