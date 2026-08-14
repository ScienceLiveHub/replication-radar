# Replication Radar — surfacing the work of research software engineers

*OpenAIRE AI Hackathon · Theme B (Build) · a Science Live contribution · CC-BY 4.0*
**Live app: [openaire-hackathon.netlify.app](https://openaire-hackathon.netlify.app) · [how it works](methodology.html) · [how to replicate](replicate.html) · `pip install replication-radar`**

## The question

Research software is first-class scholarly work — it is what makes results reproducible and reusable. But neither the citation graph nor academic credit treats it that way. The OpenAIRE Graph makes software **findable** but not **assessable**: a widely-used research tool carries the same *"0 citations, class C5"* as an abandoned script. The engineering work research software engineers do — documenting, testing, adding continuous integration, archiving, packaging for reuse — is **invisible** in the Graph.

So we asked a concrete build question: **can we surface that work — the software behind published science and the practices that make it reusable — live, on top of the OpenAIRE Graph, without changing it?**

## The journey

We started paper-first: rank the papers in a field worth replicating. It worked, but it mostly re-served the Graph's one signal (citation impact) — and when we actually *used* it, we hit a wall: on a live topic search, **essentially none of the papers carry a linked code or data artefact** (OpenAIRE almost never links materials to a paper). The thing that was both *actionable* and *undervalued* wasn't the paper — it was the **software**.

The turn came from a research software engineer. **Saranjeet Kaur Bhogal**, an RSE at Imperial College London, tried the tool and told us what an RSE actually looks for: not a single high-level "FAIR" badge, but whether code is **documented**, has **tests**, runs **CI**, **invites contribution**. That feedback reshaped the project. We stopped grading papers and started **surfacing the software behind them** — computing, live from the GitHub, Software Heritage and Zenodo APIs, both the recognised **fair-software.eu** recommendations *and* a set of **RSE good-practice** signals: **documented · tests · CI · contributing · code of conduct**, with the repository's own **CI status** as a grounded reproducibility signal, each check linking straight to the real artefact. RSE work, made visible and creditable.

We kept the other signal the Graph structurally can't hold, too: whether a claim has been independently **replicated**, read live from the Science Live **nanopublication** network (author-agnostic, retraction-aware). So a field's *reusable software* and its *checked results* surface together.

**We put it to the test.** We took a paper the Radar flags as high-impact but never replicated — Oliver et al. 2018, *"Longer and more frequent marine heatwaves"* — and actually replicated it, with an agent driven by both MCPs. It even made the science more rigorous: it *pushed back on our first data choice* — ERA5's sea-surface temperature is prescribed from the **same HadISST lineage** as the original paper, so it would not be independent — and switched to **independent ESA CCI satellite SST** (its dataset DOI found on the OpenAIRE Graph, pulled via Copernicus Marine). It detected marine heatwaves with **XMHW** (an independent RSE tool) and cross-checked the paper author's own **marineHeatWaves** — both software the Radar surfaces — agreeing to the digit. We keep the scope honest: satellite data only reaches back to ~1982, so this is a **partial, satellite-era replication** — marine-heatwave *days* rise and the trend **survives ENSO removal**, **directionally consistent** with the paper, while its full 1925–2016 *global* magnitudes stay untested for want of an independent century-scale record. A replication independent in *both* data and code, built entirely from software and data the Graph already holds. The loop, closed.

Two disciplines run through all of it. **Everything is grounded** — every signal comes from a named, verifiable source, documented signal-by-signal in a machine- and human-readable methodology page (`methodology.json` + `/methodology.html`). And everything runs **client-side** against public, CORS-enabled APIs — no backend, no keys — so the artifact is a static site anyone can fork. We even deleted the one feature we had built on a guess (keyword-matched "relevant tooling"): surfacing RSE work has to be grounded, or it is just noise.

## The insight

- **OpenAIRE lists research software — largely Zenodo deposits — but tells you nothing about whether it is reproducible or whether it has been checked.** That is exactly the gap the Radar fills: it takes those software records and adds, live, a **reproducibility read** (documented / tests / CI, with the repository's own CI status) and a **replication read** (has a claim the software supports been independently verified?). Making OpenAIRE's software **assessable — not just findable** — is the original move, and it uses only the OpenAIRE Graph plus grounded public APIs.
- **Research software is the invisible half of reproducible science, and the Graph can't see it — but GitHub, Software Heritage and Zenodo can, live.** Surfacing that changes what the Graph is *for an RSE*: from "here is a document" to "here is the software behind it, and here is how reusable it is."
- **The signals RSEs care about are *practices*, not a score.** Documented, tested, CI, contributing — each grounded in the repository's own files, each a link to the actual artefact. A green CI run is an honest reproducibility signal (the code builds and its tests pass) — explicitly *not* a claim of independent reproduction, which the replication verdict covers separately.
- **Reliability and reusability are *different categories* of signal**, not better metrics. You cannot repair the citation axis into a truth axis or a reuse axis — you *add* them, live, on top of the Graph.
- **Packaged as an MCP server, it runs next to the OpenAIRE MCP** — one gives the structural graph, the other the RSE + verification layer. Together they are a first brick of a graph of *verified, engineered* knowledge for agentic science.

## What others can reuse

- **The live web app** — pure static, queries OpenAIRE + GitHub/Software Heritage/Zenodo + the nanopub network from the browser. Fork it, point it elsewhere.
- **An MCP server** (`pip install replication-radar`) exposing the same engine to any agent, to run alongside the OpenAIRE MCP.
- **A grounded software assessment** — the fair-software.eu recommendations *plus* the RSE good-practice signals (documented / tests / CI / contributing / code of conduct + CI status), computed from GitHub + Software Heritage + Zenodo, each explained with links to go deeper (The Turing Way, goodpractice, NumFOCUS, Imperial's Essential Software Engineering course).
- **A reproducible, author-agnostic, retraction-aware verdict-index method** — FORRT Outcome/CiTO nanopubs joined on the trusty hash, with an admin-graph validity guard.
- **A machine-readable methodology & provenance spec** (`methodology.json`, CC-BY) — every signal's source and formula.
- **A feasibility map** of which open-science APIs are reachable and CORS-friendly, so the next builder doesn't re-discover it.

## Honest limits

OpenAIRE rarely links materials to a paper, so the *paper* lens surfaces reusable software only where it is separately resolved; the OpenAIRE *software* index is broad but dominated by one-off study deposits, so surfacing the best-engineered tools well is ongoing work (better sources, and the relation graph via the OpenAIRE MCP, are the next step). Discovery recall is keyword-bound; the verdict overlay covers whatever the nanopub network holds; the software assessment runs only where a real repository resolves, and GitHub's unauthenticated rate limit caps how many it scores per hour (results are cached). None of this is hidden in the output.

---

*Materials are dual-licensed: **source code under MIT**, and this write-up together with the verdict index and methodology spec under **[CC-BY 4.0](https://creativecommons.org/licenses/by/4.0/)**.*
