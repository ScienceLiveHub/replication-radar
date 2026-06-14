# Replication Radar — adding the signals the OpenAIRE Graph can't hold

*OpenAIRE AI Hackathon · Theme B (Build) · a Science Live contribution*
**Live: https://openaire-hackathon.netlify.app**

## The question

The OpenAIRE Graph can tell you how *visible* a paper is — citation influence, popularity,
impulse, the BIP! classes C1–C5. It cannot tell you two things that matter just as much:
whether the claim is **reliable** (has anyone independently checked it, and did it hold), and
whether the **software** behind it is actually reusable. Citation-popularity is a measure of
attention, and attention is orthogonal to both. A heavily-cited paper looks identical, in the
Graph, to one nobody ever reproduced; a widely-used research tool has the same "0 citations,
class C5" as an abandoned script.

So we asked a build question: **can we add those missing signals — reliability and
reusability — *live*, on top of the Graph, without changing it?**

## The journey

We started simply: rank papers by impact to find what's worth replicating. That worked, but it
just re-served the Graph's one signal. The turn came when we tried to answer "has this been
replicated?" — and realised the Graph *structurally cannot* hold that answer. Verification isn't
a paper, gets no citations, and has no record in the Graph.

But it does exist elsewhere. Science Live publishes replication outcomes as cryptographically
signed **nanopublications** (the FORRT chain: Quote → Claim → Study → Outcome → CiTO). So the
Radar pulls the verdict layer **live from the nanopub network** and overlays it on the Graph by
DOI. A key correction along the way — *verification is author-agnostic*: we don't care **who**
ran the replication, so the index is built by **template, not by person**, querying every FORRT
Outcome and CiTO on the network (39 outcomes today: 25 validated, 11 partially supported, 3
contradicted) and joining them on the nanopub trusty hash. As more people publish replications,
they flow in automatically.

Then the software side. The Graph makes research software *findable* but not *assessable* — no
impact signal, no reusability signal. We first tried to *recommend* tooling and it failed badly
(keyword-matching surfaced off-topic repos), so we pivoted from recommendation to **assessment**.
We checked whether standard FAIR-assessment services (F-UJI, OSTrails) could score software via
an API — they couldn't (data-oriented, no usable endpoint) — and instead computed the
**fair-software.eu** five recommendations ourselves, live, from the GitHub and Software Heritage
APIs. So each replication's code now carries a FAIR-software score and real usage, sourced
directly.

Everything runs **client-side in the browser** against public, CORS-enabled APIs — no backend,
no keys — so the whole thing deploys as a static site anyone can open.

## The insight

- **Reliability and reusability are *different categories* of signal**, not better metrics. You
  can't repair the citation axis into a truth axis or a reuse axis — you have to *add* them. And
  you can add them *live*, on top of the Graph, without waiting for it to change.
- **Verification is author-agnostic and network-wide.** Keying it on a template rather than a
  person turns a personal portfolio into a community trust layer.
- **Grounded-only is a discipline, not a nicety.** Every signal the Radar shows comes from a
  named, verifiable source. The one feature we built on a guess (keyword tooling) we deleted —
  and the project is stronger for it.

## What others can reuse

- **The live web app** — pure static, queries OpenAIRE + the nanopub network + GitHub/Software
  Heritage from the browser. Fork it, point it elsewhere.
- **An MCP server** (`pip install replication-radar`) exposing the same engine to any agent,
  next to the OpenAIRE MCP.
- **A reproducible, author-agnostic verdict-index method** — two SPARQL queries over the FORRT
  Outcome/CiTO templates, joined on the trusty hash. Anyone's replication network can be read
  this way.
- **A grounded software-FAIR assessment** — the fair-software.eu recommendations + usage,
  computed from GitHub + Software Heritage (no third-party scorer needed).
- **A feasibility map of the open-science API landscape** — what's reachable and CORS-friendly
  (OpenAIRE Graph API, the nanopub-network SPARQL, GitHub/SWH/Zenodo) and what isn't (F-UJI/
  OSTrails assessment APIs; per-paper relations from the public Graph API; Knowledge Loom's
  unresolvable internal DOIs) — so the next builder doesn't re-discover it.

*A complementary facet, using the OpenAIRE MCP's citation-graph tools, traces the relationships
around a verified paper — and shows the citation graph contains everything **except** the
verification edge, which is exactly the gap the Radar fills.*

## Honest limits

Discovery recall is keyword-bound (OpenAIRE free-text terms are AND-ed); the verdict overlay is
network-wide but only covers claims that have a DOI a search can reach (paperless/Mode-B
verifications exist but can't surface in a DOI search); FAIR-software runs only where a real
repository resolves, and GitHub's unauthenticated rate limit caps how many it scores per hour;
OpenAIRE's own subject classification is sometimes quirky and is shown faithfully, not corrected.
None of this is hidden in the output.

---

*Materials are dual-licensed: **source code under MIT**, and this write-up together with the
verdict index under **[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.*
