# Replication Radar — adding the signals the OpenAIRE Graph can't hold

*OpenAIRE AI Hackathon · Theme B (Build) · a Science Live contribution*
**Live app: https://openaire-hackathon.netlify.app · how it works: /methodology.html · `pip install replication-radar`**

## The question

The OpenAIRE Graph is a network of **structural links** between research entities — papers,
authors, institutions, funding. It can tell you how *visible* a paper is (citation influence,
popularity, the BIP! classes C1–C5), but not what it *means*: it links documents to one another
without representing the **claims** inside them, their level of evidence, their **epistemic
status** (confirmed, contested, retracted, superseded), or the **semantic relations between
results** — replication, contradiction, refinement, not just "cites".

That gap matters more than ever in the age of LLMs. A model fed the Graph swallows everything
equally: a result replicated fifty times reads the same as a single study on twelve mice or an
unreviewed preprint. The difference between *recognising text patterns* and *understanding* is
exactly this missing layer — verified, status-aware, traceable knowledge that a system can **cite
instead of paraphrase**. OpenAIRE is the infrastructure best placed to start closing that gap at
European scale.

So we asked a concrete build question toward it: **can we add the two most actionable missing
signals — is a claim *reliable* (independently checked, and did it hold) and is its *software*
reusable — live, on top of the Graph, without changing it?** A heavily-cited paper looks
identical, in the Graph today, to one nobody ever reproduced; a widely-used research tool has the
same "0 citations, class C5" as an abandoned script. Both are signals the Graph structurally
cannot hold.

## The journey

We started simply: rank papers by impact to find what's worth replicating. That worked, but it
just re-served the Graph's one signal. The turn came when we tried to answer "has this been
replicated?" — and realised the Graph *structurally cannot* hold that answer. A verification isn't
a paper, gets no citations, and has no node in the Graph.

But it does exist elsewhere. Science Live publishes replication outcomes as cryptographically
signed **nanopublications** (the FORRT chain: Quote → Claim → Study → Outcome → CiTO). So the
Radar pulls the verdict layer **live from the nanopub network** and overlays it on the Graph by
DOI. Several corrections shaped the design along the way:

- **Verification is author-agnostic.** We don't care *who* ran the replication, so the index is
  built **by template, not by person** — querying every FORRT Outcome and CiTO on the network and
  joining them on the nanopub trusty hash. Today that surfaces **31 independent, signed
  replication outcomes across 21 papers**; as more people publish replications, they flow in
  automatically.
- **Enumeration has to be the right shape.** We verified empirically that walking the nanopub
  graph outward from a paper *bleeds* into adjacent chains (it once pulled a lizard study into a
  bumble-bee paper's replications) and *misses* disconnected ones, so we enumerate by the
  **CiTO→DOI verdict-citation** instead — the set that is actually correct.
- **Validity is part of the verdict.** A retracted or superseded outcome must not count. The
  overlay filters any outcome retracted/invalidated/superseded **by its own signer**, via the
  nanopub admin graph — only the original author can retract their own work.
- **Reproduce ≠ replicate, and agreement matters.** We surface the FORRT distinction (materials
  available = reproducible; tested by a different route = replicated) and an **agreement pattern**
  — robustly-validated, validated, contested, refuted — computed from the verdict spread, so
  "five replications that all agree" reads differently from "five that disagree".
- **What, not just whether.** Each verdict carries the **claim it actually tested** — the atomic
  AIDA statement, traversed Outcome → Study → Claim — so a card says not "Validated" but
  *"Validated: ‘per-species extirpation rankings are sensitive to the grid resolution’"*.

Then the software side. The Graph makes research software *findable* but not *assessable*. We
first tried to *recommend* tooling and it failed badly (keyword-matching surfaced off-topic
repos), so we pivoted from recommendation to **assessment**, and after checking that standard
FAIR services (F-UJI, OSTrails) had no usable API, computed the **fair-software.eu** five
recommendations ourselves, live, from the GitHub and Software Heritage APIs.

Two disciplines run through all of it. **Everything is grounded** — every signal comes from a
named, verifiable source, and is documented, signal by signal, in a **machine- and human-readable
methodology page** (`methodology.json` + `/methodology.html`) that states where each label and
score comes from and how it is computed. And everything runs **client-side** against public,
CORS-enabled APIs — no backend, no keys — so the whole thing is a static site anyone can open,
and it ships accessible (Lighthouse accessibility 100, colour-blind-safe, keyboard-operable).

## The insight

- **Nanopublications are the substrate the Graph is missing — and the AI hook.** The verdict
  layer isn't scraped text; it's built from claim-level, cryptographically-signed assertions that
  already carry what the Graph lacks: the claim, its epistemic relation (`cito:confirms` /
  `disputes` / `qualifies`), and its provenance. So the Graph gains, for a paper, not "this
  document exists" but "*this specific claim was independently checked → validated → here is the
  signed verdict*". That is exactly what an LLM needs to **cite rather than hallucinate**. We
  package it as an **MCP server** that an agent runs **next to the OpenAIRE/Alien MCP**: one gives
  the structural graph, the other answers "has this been checked, and did it hold". Together they
  are the first bricks of a graph of **verified knowledge**.
- **Reliability and reusability are *different categories* of signal**, not better metrics. You
  can't repair the citation axis into a truth axis or a reuse axis — you have to *add* them, and
  you can add them *live*, on top of the Graph, without waiting for it to change.
- **Verification is author-agnostic and network-wide.** Keying it on a template rather than a
  person turns a personal portfolio into a community trust layer.
- **Grounded-and-transparent is a discipline, not a nicety.** Every signal is sourced and
  documented; the one feature we built on a guess (keyword tooling) we deleted — and the project
  is stronger for it.

## What others can reuse

- **The live web app** — pure static, queries OpenAIRE + the nanopub network + GitHub/Software
  Heritage from the browser. Fork it, point it elsewhere.
- **An MCP server** (`pip install replication-radar`) exposing the same engine to any agent, to
  run alongside the OpenAIRE MCP — the verified-knowledge layer for agentic workflows.
- **A reproducible, author-agnostic, retraction-aware verdict-index method** — FORRT
  Outcome/CiTO templates joined on the trusty hash, with the admin-graph validity guard. Any
  replication network can be read this way.
- **A machine-readable provenance & methodology spec** (`methodology.json`, CC-BY) — every
  signal's source and formula, reusable as a transparency pattern for any composite-score tool.
- **A grounded software-FAIR assessment** — the fair-software.eu recommendations + usage,
  computed from GitHub + Software Heritage (no third-party scorer needed).
- **A feasibility map of the open-science API landscape** — what's reachable and CORS-friendly
  (OpenAIRE Graph API, the nanopub SPARQL + admin graph, GitHub/SWH/Zenodo) and what isn't
  (F-UJI/OSTrails assessment APIs; per-paper relations from the public Graph API) — so the next
  builder doesn't re-discover it.

*A complementary facet by Jean Iaquinta uses the **OpenAIRE MCP's** citation-graph tools to trace
the relationships around a verified paper — and shows the citation graph contains everything
**except** the verification edge, which is exactly the gap the Radar fills.*

## Honest limits

Discovery recall is keyword-bound (OpenAIRE free-text terms are AND-ed); the verdict overlay is
network-wide but only covers claims with a DOI a search can reach; FAIR-software runs only where a
real repository resolves, and GitHub's unauthenticated rate limit caps how many it scores per hour
(results are cached so repeated use stays stable); OpenAIRE's own subject classification is
sometimes quirky and is shown faithfully, not corrected. None of this is hidden in the output. And
we add only two of the missing layers — reliability and reusability; the fuller graph of *verified
knowledge* (claim-level extraction at scale, temporal obsolescence, distinguishing hypothesis from
result from interpretation) is the direction this points at, not something we finished.

---

*Materials are dual-licensed: **source code under MIT**, and this write-up together with the
verdict index and methodology spec under **[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.*
