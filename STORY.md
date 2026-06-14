# Replication Radar — adding the signals the OpenAIRE Graph can't hold

*OpenAIRE AI Hackathon · Theme B (Build) · a Science Live contribution*
**Live: https://openaire-hackathon.netlify.app**

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
exactly this missing layer — verified, status-aware, traceable knowledge. It's what would let a
system say "three meta-analyses, 45 000 subjects, with a 2021 result that qualifies it for older
populations" instead of a vague, unciteable "studies show X". OpenAIRE is the infrastructure best
placed to start closing that gap at European scale.

So we asked a concrete build question toward it: **can we add the two most actionable missing
signals — is a claim *reliable* (independently checked, and did it hold) and is its *software*
reusable — live, on top of the Graph, without changing it?** A heavily-cited paper looks
identical, in the Graph today, to one nobody ever reproduced; a widely-used research tool has the
same "0 citations, class C5" as an abandoned script. Both are signals the Graph structurally
cannot hold.

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
- **Nanopublications are the substrate the Graph is missing.** The verdict layer isn't scraped
  text — it's built from claim-level, cryptographically-signed assertions that already carry what
  the Graph lacks: the claim, its epistemic relation (`cito:confirms` / `disagreesWith` /
  `qualifies`), and its provenance. So the Graph gains, for a given paper, not "this document
  exists" but "*this specific claim was independently checked → validated → here is the signed
  verdict*" — traceable enough for a model to cite rather than paraphrase. That's the first brick
  of a graph of **verified knowledge**.

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

*A complementary facet by Jean Iaquinta, using the OpenAIRE MCP's citation-graph tools, traces
the relationships around a verified paper — and shows the citation graph contains everything
**except** the verification edge, which is exactly the gap the Radar fills.*

## Honest limits

Discovery recall is keyword-bound (OpenAIRE free-text terms are AND-ed); the verdict overlay is
network-wide but only covers claims that have a DOI a search can reach (paperless/Mode-B
verifications exist but can't surface in a DOI search); FAIR-software runs only where a real
repository resolves, and GitHub's unauthenticated rate limit caps how many it scores per hour;
OpenAIRE's own subject classification is sometimes quirky and is shown faithfully, not corrected.
None of this is hidden in the output. And we add only two of the missing layers — reliability and
reusability; the fuller graph of *verified knowledge* (claim-level extraction, temporal
obsolescence, distinguishing hypothesis from result from interpretation) is the direction this
points at, not something we built.

---

*Materials are dual-licensed: **source code under MIT**, and this write-up together with the
verdict index under **[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.*
