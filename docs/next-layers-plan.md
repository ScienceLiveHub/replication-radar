# Replication Radar — the verified-knowledge layer: full plan

*Last updated 2026-06-14. Proposal — nothing in here is built yet. Grounded on two live-probe maps:
[`link-types.md`](./link-types.md) (nanopub connective layer) and [`openaire-mcp.md`](./openaire-mcp.md)
(OpenAIRE MCP capabilities + RO-Crate / paper↔software / FOS findings). Every count cited below was
read live from a named API; re-verify before building on it.*

---

## 1. Vision

Replication Radar today adds, on top of the OpenAIRE Graph and grounded only, two signals the Graph
structurally can't hold: **is a claim reliable** (independently checked, and did it hold) and **is its
software reusable** (FAIR score). The next stage grows this into a **verified-knowledge layer** — and
the realisation from this session's probing is that the same engine supports **three lenses**:

> **VERIFY** — *was this result independently checked?* (the current overlay, deepened)
> **DISCOVER** — *what is worth replicating, applying to real data, or porting across disciplines?*
> **ASSESS** — *does this researcher/project produce verifiable, reusable, diverse outputs?* (CoARA)

One backend (OpenAIRE Graph + OpenAIRE MCP + the nanopub network), three views. This is more than a
feature list: it **closes the loop with the producer side**. The
[`forrt-replication-template`](../../forrt-replication-template) is how a researcher *acts on* a
candidate; the result publishes back as a FORRT nanopub chain; the Radar then verifies it and feeds
the next discovery. Discover → Act (template) → Publish (nanopub) → Verify (Radar) → Discover.

## 2. The constraint that shapes the architecture

The OpenAIRE **MCP needs OAuth** (Alien gateway) and runs agent-side. The **public static web app
must never hold a token** (`CLAUDE.md` guardrail). Two tracks follow:

- **Browser-app track** — the live site (`site/`), public CORS APIs only (nanopub SPARQL + public
  OpenAIRE Graph REST). Cheap, votable, no secrets.
- **MCP-server track** — `src/replication_radar` (`pip/uvx`), agent-side, full MCP access. Home of
  the citation-graph, discovery, and CoARA capabilities.
- **The bridge — bake-to-static.** Run the MCP at *curation time* to emit static JSON (exactly how
  `verdicts.json` already works), which the browser renders live. This lets MCP-powered features
  appear in the voted artifact **with no token in the browser.** This pattern is what makes the
  flagship possible.

## 3. Guardrails (non-negotiable, from `CLAUDE.md` — learned the hard way)

- **Grounded sources only.** Every signal from a real named source (OpenAIRE / nanopub network /
  GitHub / SWH / Zenodo / FOS codes / citation links). **No relevance-by-keyword-guessing** — this
  killed the old "independent tooling" feature and is the #1 risk for the Discover lens.
- **Verify APIs live before wiring.** (Done for everything below.)
- **Never claim it works without running it.** Node-check `app.js`; test against the live API.
- **No unverifiable numbers on screen.** Every count must be defensible (a `pagination.total` from a
  named call, a real link count). Ship **profiles and evidence anchors, not black-box scores.**
- **The tool surfaces leads; a human judges.** Especially for Discover — present evidence, not verdicts.

## 4. Evidence base (verified this session)

- **Nanopub chain** is fully mapped (12 templates): `Outcome 39 · CiTO-FORRT 64 · Study 37 · Claim 32
  · Research-Software 43 · AIDA 1279 · Research-Synthesis 4 · Quote 153 …` joined as
  `Outcome→Study→Claim→AIDA`, `Outcome←CiTO→DOI`, `Software→{paper,Claim,Outcome,GitHub}`. The
  **Claim/AIDA** hop is one step from what the app already traverses but unused. (`link-types.md`)
- **OpenAIRE MCP** is healthy on this VM (no auth prompt). Powerful: `get_citation_network` /
  `explore_research_relationships` (typed edges; 610 for the Soroye anchor), `get_author_profile
  (product_type)`, `search_research_products + *_class`. Broken/sparse: `find_by_*_class` with a
  query (→0), `find_datasets_by_topic` (→0), name search + co-author/org tools (drift). (`openaire-mcp.md`)
- **Paper↔software links exist natively** (~1.19M software→pub, ~1.26M pub→software) but generic
  (`cites`/`isCitedBy`, no semantics) and **patchy per-product** (Soroye, Snakemake, Anne's
  replication sw all = 0). → OpenAIRE has the *wire*; the nanopub layer adds the *meaning* + verdict.
- **CoARA is feasible, grounded** — keyed on **ORCID**, per-type counts reconcile exactly (Anne =
  81 pub + 11 sw + 5 data + 7 other = 104; Stian = 116). Name search conflates (Anne by name = 647).
- **Discovery is groundable** — FOS codes are per-product; the `fos` filter quantifies cross-discipline
  headroom (HEALPix 662 astro → 3 earth-science, incl. *Deep Learning Weather Prediction on the
  HEALPix Mesh*); benchmark clusters are queryable (EuroSAT = 285). **RO-Crates are in OpenAIRE**
  (`type=other`, `instance_type="Research Object"`; Anne's own `…climate.rocrate.zip`).

## 5. The three lenses in detail

### LENS A — VERIFY (deepen the current overlay)

**A1 · Claim + AIDA hop** *(browser app; nanopub SPARQL; no auth).*
Add `Study —slt:targetsClaim→ Claim —slt:asAidaStatement→ AIDA`. Turns *"this paper was validated"*
into *"the claim ‹increased thermal exposure predicts higher Iberian Bombus extirpation› was
independently validated."* One extra SPARQL join on the endpoint already in use. **Highest
value-per-effort; cheap; it also supplies the node labels Lens B needs.** Risk: low.

**A2 · "Missing verification edge" graph view** *(browser app, MCP baked-to-static).*
For each curated verified paper, bake (via `get_citation_network`, curation time → static JSON) its
OpenAIRE neighborhood, render it, and **highlight the edge OpenAIRE lacks**: the signed Outcome→DOI
the Radar supplies. Two tiers on one canvas — generic OpenAIRE `cites`/paper↔software links **plus**
the semantic, verdict-bearing nanopub edges on top. This is the **proof-of-thesis** and the best
single screen for the community vote. **Absorbs Jean Iaquinta's citation-graph facet into the main
artifact.** Risk: medium (graph viz; gateway credits at curation time only).

### LENS B — DISCOVER (the candidate engine; the bold, Theme-B headline)

Three grounded mechanics (each ships an evidence anchor; a human judges; an agent may read the
abstract to confirm). *Primarily MCP-server track; curated results can bake to the app.*

- **B1 · Software → replication candidate** — reusable tool (high paper→software citation count +
  FAIR score) with **no** replication-Outcome nanopub yet. "Widely used, never independently checked."
- **B2 · Paper → real-world-application candidate** — method whose linked datasets are known
  **benchmarks** (EuroSAT/ImageNet/synthetic), with no real-world/observational dataset link.
  "Proven on a benchmark, never on real data." (EuroSAT = 285-paper cluster proves detectability.)
- **B3 · Cross-discipline transfer** — (a) *boundary object*: method whose citing papers span ≥2
  top-level FOS; (b) *transfer headroom*: method dominant in FOS-A, ~absent in FOS-B. Proven:
  HEALPix 662 astro → 3 earth-science. Surfaces e.g. "this astrophysics pixelization → 3 EO uses so
  far → headroom for plankton/biodiversity"; "OME-Zarr (bioimaging) ↔ GeoZarr (EO)" shared substrate.

**Guardrail focus:** B3 is the keyword-guessing minefield. Ground every lead on FOS + real
links + arXiv cross-listings + the existing-crossover proof; never free-text similarity. Show the
counts as the justification.

### Scoring already exists — evolve it, don't reinvent it

The app **already** computes a replicability score and sorts most-replicable first
(`app.js:213` `readiness = 0.5*impact + 0.3*(topic has tools) + 0.2*(topic has data)`). The plan is to
**evolve this skeleton**, not invent scoring. First fix = the topic-level proxies (`tools`/`hasData`
describe the *search topic*, not *this paper* — the WiSDM trap: relevance ≠ readiness). Full evolution
(per-paper link-verified materials with an explicit **"unknown ≠ absent"** state, status taxonomy,
recency/impulse, transparent breakdown) + the demo script are in
[`readiness-scoring-plan.md`](./readiness-scoring-plan.md).

### Candidate status — "not replicated" is ambiguous, and that is the point

A naive sort ("validated = good, not-replicated = skip") is **wrong**. Absence of a replication can
mean *ignored/weak* OR *too new to have been picked up* — opposite signals. Assess must
**disambiguate**, typing each candidate on **verification status × replication-readiness**, with
**recency / impulse** resolving the empty cell:

| Status | Grounded signal | Meaning for a replicator |
|---|---|---|
| **Validated** | validated Outcome nanopub | solid — build on / extend |
| **Contested** | contradicted/partial Outcome | needs care; worth re-checking |
| **Replication-ready, unreplicated** ⭐ | no Outcome **but** paper↔software(+data) linked, **recent** / high **impulse** | **prime candidate — gap + means + momentum** |
| **Unreproducible-as-is** | no Outcome, no linked code/data | high effort (rebuild materials first) |
| **Dormant-unchecked** | no Outcome, old, low impulse, no materials | foundational-but-unverified, or stale |

All signals are already verified to exist: materials linked = paper↔software (~1.2M) / paper↔dataset
links, a nanopub Research-Software node, or — strongest — an **RO-Crate** (paper+code+data+provenance;
Anne's `…climate.rocrate.zip`); too-new-vs-ignored = publication **date** + **impulse** class (early
momentum); already-checked = presence of the verdict overlay. The **"replication-ready & unreplicated
& recent"** bucket is the gold the tool surfaces — and it doubles as a Discover query.

### LENS C — ASSESS (CoARA; the responsible-assessment angle OpenAIRE cares about)

**C1 · Output-diversity + reproducibility profile** *(MCP-server track; ORCID-keyed).*
Per researcher/project: exact per-type output counts (`search_research_products(author_orcid=…,
type=…)` → reconciling totals) **×** the verified-knowledge layer ("how many outputs carry a
replication verdict / FAIR score?"). Citation-count sees ~nothing (most outputs are "0 citations");
this sees a workflow- and RO-Crate-rich, reproducible contributor. **Differentiator no other tool
produces.** Ship a **profile, not a score**. Limits: ORCID-rich only; avoid name/org/network tools.

## 6. Sequenced roadmap

| Phase | Deliverable | Track | Why here | Risk |
|---|---|---|---|---|
| **1** | **A1 Claim/AIDA hop** | app | cheap; sharpens story; dependency for A2 | low |
| **2** | **A2 Missing-edge view** (flagship, proof-of-thesis) | app + MCP-bake | best vote artifact; folds in Jean's facet | med |
| **3** | **B3 Cross-discipline transfer** *(or B2)* — the Discover headline | MCP-server (+ bake a curated demo) | highest wow + most Theme-B; closes loop with template | med-high |
| **4** | **C1 CoARA profile** | MCP-server | responsible-assessment angle; reuses engine | med |
| **5** | Polish: screencast/GIF for the vote (21–29 Aug); README; CC-BY | — | submission readiness | low |

**Rationale:** prove the thesis on the votable artifact first (1→2), then make Discover the bold
second feature that reframes the product as a *graph utility, not just an overlay* (3), with CoARA as
the assessment lens if time allows (4). Deadline 2026-08-20; community vote 21–29 Aug; ample runway.

## 7. Deferred / out of scope (with reasons)

- **Research Synthesis** (`cito:isSupportedBy`, only 4 net) — great shape, too sparse; revisit.
- **CiTO-generic DOI↔DOI** (110) — overlaps the richer MCP relationship tools; skip.
- **Quote layer** (153) — fold into A1 only if cheap.
- **Org-level CoARA / co-author networks** — disambiguation drifts; scope to ORCID people/projects.
- **RO-Crate ↔ nanopub link** — no such nanopub link-type exists yet, but RO-Crates ARE in OpenAIRE
  and bundle workflow+data+code+provenance; a natural Lens-B / Lens-C node once 1–4 land.
- **`find_by_*_class` + query, `find_datasets_by_topic`, `discover_by_subject`** — broken/noisy; use
  `search_research_products` + `*_class` / `type` instead.

## 8. Open decisions (for review)

1. **Product framing:** adopt **Verify / Assess / Discover (3 lenses)** as the headline, or keep the
   tighter verification-only story? (Plan above assumes 3 lenses, sequenced so each stands alone.)
2. **Discover flagship:** **B3 cross-discipline** (highest wow, highest guardrail risk) vs **B2
   benchmark→real-world** (very concrete, fundable)? Sets where Phase 3 digs first.
3. **MCP in the voted artifact?** Confirm the bake-to-static bridge (A2) is wanted, vs keeping the
   MCP purely agent-side (server + `/radar` skill) and the app on public APIs only.
4. **Jean's facet** = the A2 edge-view itself, or a parallel deliverable? (Plan assumes it *is* A2.)
