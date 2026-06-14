# OpenAIRE MCP — capability map (the new power on this VM)

*Probe date: 2026-06-14. REPORT-ONLY: every row below was produced by a **live** call to the
`openaire` MCP server on this machine; no claim here is from memory. Server health: `healthy`,
`mcp-openaire` v0.1.28, **no auth prompt** — it is wired and working on this VM.*

> **Architecture constraint (decisive for planning):** the MCP runs **agent-side** behind the
> Alien gateway (OAuth). Per `CLAUDE.md`, the public static web app must **never** hold a token.
> So MCP-backed features belong in the **`src/replication_radar` MCP server / agentic exploration**,
> **not** in the browser app. The browser app stays on public CORS APIs (nanopub SPARQL + the
> public OpenAIRE Graph REST API). Keep this split in mind when reading the "direction" column.
>
> **Confirmed (live `_debug.api_urls_called`, 2026-06-14):** the MCP queries the **same open
> OpenAIRE Graph** as the app — `api.openaire.eu/graph/v2/researchProducts` (search) and
> `api.openaire.eu/graph/v1/researchProducts/links` (relationships). There is **no private/fuller
> dataset** behind the gateway; OAuth is access control, not a different graph. The app uses v1
> search and does **not** call `/links` — that relationship endpoint (public, ~1.2M paper↔software
> edges globally) is the one capability the app could adopt directly, no MCP needed. For
> biodiversity/EO papers it returns only paper→paper `cites` (verified), so it does not close the
> materials gap for this domain.

Directions: **(i)** verified-knowledge graph (typed links between results) · **(ii)** CoARA
(assess researchers/projects by output *diversity* + reproducibility + reuse, not citations) ·
**(iii)** validating/strengthening the Radar's impact ranking.

---

## Relationship & citation-graph tools — direction (i)

| Tool | Inputs run | Returns | Real result from this probe | Beats public REST? | Dir |
|---|---|---|---|---|---|
| **`explore_research_relationships`** | `target_pid=10.1126/science.aax8591, page_size=5` | typed `source`/`target` edges (id, type, title) + `provider` + `total_unfiltered`; ScholeXplorer v3 | **610 incoming edges**; e.g. preprint `10.1101/2023.10.19.563135` *"…Refuge for the Critically Endangered Rusty Patched Bumble Bee"* → `cites` anchor (Crossref) | **Yes** — directed citation edges + per-edge provenance, cross-type | (i) |
| **`get_citation_network`** ⭐ | `identifier=…aax8591, direction=both, max_nodes=15` | `nodes[]`(id,title,type,citations,is_center) + `edges[]`(source,target,type); fuses Graph v2 + ScholeXplorer | 15 nodes / 14 edges; center **593 citations**; both `…563135 → anchor` and `anchor → 10.1038/nclimate1539` | **Yes** — finished bidirectional graph in one call | (i) |
| **`get_research_links`** ⭐ | `source_pid=…aax8591, page_size=10` | OpenAIRE-**native** link records: full source/target objects (dedup IDs, instance_type, `collected_from`) + typed `relation` (name + `type_schema`); Graph v1 | **53 links**; anchor → `cites` → *"Country-specific effects of neonicotinoid pesticides…"*, collected_from Science/NERC | **Yes** — richest per-edge provenance; the native edge feed | (i) |
| `build_subgraph_from_dois` | `dois=[…aax8591, 10.5281/zenodo.20113778]` | `nodes[]` + `edges[]` + `statistics` | **0 edges, 2 isolated nodes** (honest — the two are genuinely unlinked) | Partial (only if DOIs are mutually linked) | (i) |
| `get_relationship_types` | — | 19 relation types + inverses | incl. `IsSupplementTo`, `Documents/IsDocumentedBy`, **`Obsoletes`**, `Reviews`, `Compiles` | reference | (i) |

**Typed-link caveat (verified):** the *capability* for `isSupplementTo` / `isDocumentedBy`
(paper↔dataset↔software) edges is present (relation vocabulary + `relation` filter param), but the
Soroye anchor happens to expose **only `cites`→publication** edges; a different anchor is needed to
*demonstrate* dataset/software edges. `get_research_links target_type=dataset` returned `total:1`
but 0 rows (pagination off-by-one) — note as a quirk.

## Author / project / org tools — direction (ii) CoARA

| Tool | Inputs run | Returns | Real result | Beats public REST? | CoARA value |
|---|---|---|---|---|---|
| **`get_author_profile`** ⭐ | `orcid=0000-0002-1784-2920`; then `product_type=[software,dataset]` | aggregated profile: pub count, co-authors, research areas, dated outputs; **`product_type` filters by type** | "104 outputs, 37 co-authors"; type-filtered → **16 software+dataset** (Zotero Replication Checker, DGGS Benchmark Replication Environment) | **Yes** — disambiguates + aggregates type counts in one call | **HIGH** — `product_type` *is* the output-diversity metric |
| **`get_project_outputs`** ⭐ | `project_id=corda…cf76, type=all` | output list with **per-TYPE counts** + OA flags | "Total 43; Publications 10, Datasets 0, Software 0"; e.g. *"An international consensus on core reproducibility items…"* | **Yes** — project→outputs with type breakdown | **HIGH** — per-type counts = CoARA output diversity for a project |
| `get_project` | `project_id=corda…cf76` | metadata + **OA-mandate flags** + subjects | OSIRIS, EC HORIZON-RIA, €1.69M, **OA Publications=True, Data=True** | Yes (OA flags) | MED — reproducibility-relevant context |
| `analyze_coauthorship_network` | `orcid=…2920, limit=30` | collaboration graph: count, edges, top collaborators + paper counts | "86 collaborators; Daniel Wiesmann (4)" — **⚠ ORCID drifted to co-author "Tina Odaka"** | Yes (computed network) | MED — breadth signal, but disambiguation suspect |
| `discover_by_coauthors` | `dois=[10.5281/zenodo.8431300]` | related products via author networks | 5 products — **⚠ seed resolved to an unrelated author**, off-topic | Yes (traversal) | MED — noisy |
| `search_projects` | `search="reproducibility open science"` | paged projects | total 9; OSIRIS, NWO "FAIR for AI", UKRI | comparable | MED — entry point |
| `get_person` / `search_persons` | `person_id=…`; `last_name=Fouilloux` | identity + co-authors / paged people | get_person: 20 co-authors; search_persons total **8** (NOT empty — `last_name` worked) | marginal | LOW — identity only, no outputs |
| `get_organization` / `search_organizations` | `…`; `search="University of Oslo", country=NO` | org identity / paged orgs | many low-quality `pending_org_` sub-units | marginal | LOW |
| `rank_organizations_by_output` | `country=NO, product_type=[software], max=5` | orgs ranked by output count, **per type** | all 5 returned **0 software** (matched fragmentary sub-orgs) | Yes in principle | MED-HIGH *if* org resolution improves |
| `rank_organizations_by_citations` | `country=NO, search=university` | orgs ranked by weighted C1/C2/C3 score | "Oslo University College C2=1 C3=5" | yes | LOW — citation-based, counter to CoARA |

## Impact / ranking tools — direction (iii) validate the Radar

| Tool | Inputs run | Returns | Real result | Impact axis | Dir |
|---|---|---|---|---|---|
| **`get_research_product_details`** ⭐ | `identifier=10.1126/science.aax8591` | full metadata + **all 4 BIP! metrics with class labels** | Soroye 2020: Citations 593; **Influence C3**, **Popularity C2**, **Impulse C1** | all 4 axes at once | (iii) — best per-paper badge source |
| **`search_research_products`** ⭐ | `query=…, influence_class=[C1,C2,C3], sort_by=influence DESC` (also `impulse_class`, `type=[dataset]/[software]`) | filtered + impact-ranked product list | "bumble bee climate" → 3-of-3 high-influence; impulse C1 → only Soroye; type=dataset → 4,666; type=software → 7,162 | per-axis BIP! class **+** output type | (iii) + (i)/(ii) |
| `analyze_research_trends` | `search="bumblebee climate", 2015–2024` | per-year counts | total 227, peak 2021 (40) | volume, not impact | (i)/(ii) framing |
| ⚠ `find_by_influence_class` / `find_by_popularity_class` / `find_by_impulse_class` / `find_by_citation_count_class` | class=`C1` **+ `query`** | — | **0 of 0 with any `query`** (37,622 without). **Broken/over-restrictive when topic-scoped.** | — | avoid for topic filtering |

**Sparse / unreliable (confirmed live, avoid):** `find_datasets_by_topic` → **0** (scanned 10 pubs,
no ScholeXplorer dataset links); `discover_by_subject` → noisy (bumblebee seed surfaced a dengue-ML
paper via SDG-tag overlap); the four `find_by_*_class` tools → 0 whenever a `query` is supplied;
`search_datasets` → thinner metadata than `search_research_products(type=[dataset])`.

---

## Paper ↔ software links ARE in OpenAIRE — but generic, and patchy (verified)

Tested globally via `get_research_links` (not per-anchor): the paper↔software edge exists at scale.
- **software → publication: 1,186,266** links (e.g. `iscitedby`: *graphIO* sw → a model-editors
  study; *Aegean* sw → an astronomy paper).
- **publication → software: 1,255,849** links (e.g. `cites`: a soil-phosphorus paper →
  *geopandas v1.1.2*; an LLM-health paper → *diffusers*).
- Plus **Software Papers** as first-class records (`instance_type="Software Paper"`, 239
  high-influence: xarray 982 cites, PIVlab 1,659, PyPSA, DifferentialEquations.jl).

**Two catches that matter for the verified-knowledge layer:**
1. **Per-product coverage is uneven.** The link *type* is populated at scale, but specific products
   often have **0**: Snakemake paper (`10.1093/bioinformatics/bts480`), Snakemake software
   (`zenodo.19235408`), Soroye paper + Anne's replication software (`zenodo.20113778`) all returned
   zero. Query, don't assume — and expect gaps on fresh Zenodo deposits / methods papers.
2. **The relation is generic, not semantic.** Edges are mostly `cites` / `isCitedBy` (+ similar-docs).
   OpenAIRE says *that* paper↔software are connected, **not how** — no `supports`, `documents`,
   `isSupplementTo`, no verdict.

**Implication (sharpens the thesis):** OpenAIRE holds the paper↔software *wire* (~1.2M each way) but
not its *meaning*. The nanopub **Research-Software** node types it (`cito:supports` → paper+Claim,
`schema:result` → Outcome, + FAIR score) and the **Outcome** adds the verdict. And where OpenAIRE has
no edge at all (Soroye replication, Anne's software = 0), the nanopub is the *only* source of the
paper↔software↔verdict link. So the edge-view can render generic OpenAIRE links **plus** the semantic
nanopub edges layered on top.

## Discovery signals: FOS codes + links enable GROUNDED candidate-finding (verified)

Tested whether the link graph + metadata can power a *candidate-finder* (software worth replicating;
papers worth applying to real data; cross-discipline transfer) **without** keyword-guessing (the
anti-pattern that got the old "independent tooling" feature deleted — see `CLAUDE.md` guardrails).

**FOS / subject codes are real, structured, per-product** (via `get_research_product_details`):
e.g. DeepSphere returns *"FOS: Computer and information sciences · CS-Machine Learning · Cosmology
and Nongalactic Astrophysics (astro-ph.CO) · CS-AI · Computer Vision (cs.CV)"* — multiple
disciplines + arXiv categories on one record. Disciplinary spread is **measurable, not guessed**.

**The `fos` filter + a topic query isolates cross-discipline transfer, and quantifies headroom:**
- `query="HEALPix"` → **662** products (overwhelmingly astrophysics: Górski 5032 cites, Planck, HI4PI).
- `query="HEALPix"` + `fos=["0105 earth and related environmental sciences"]` → **exactly 3**:
  *"Deep Learning Weather Prediction using the HEALPix Mesh"*, *"evaluating climate models across
  spatial scales"*, *"Montage Image Mosaic Toolkit"*. → A method with **662 astro instances but 3 in
  earth science = large transfer headroom, with 3 real crossovers as proof the transfer works.**
- `query="EuroSAT"` `type=publication` → **285** papers, nearly all "land-cover classification on the
  EuroSAT benchmark" → the "validated only on a benchmark" cluster is queryable.

**Three grounded candidate-finder mechanics (each cites real metadata, never free-text similarity):**
1. **Software → replication candidate:** high paper→software citation count (reuse) + a FAIR score,
   but no replication-Outcome nanopub. (Sources: `get_research_links` counts + existing FAIR + the
   verdict overlay's absence.)
2. **Paper → real-world-application candidate:** linked datasets are known **benchmarks**
   (EuroSAT/ImageNet/synthetic) with no link to a real-world/observational dataset. (Sources:
   paper↔dataset links + a curated benchmark-DOI list + dataset subjects.)
3. **Cross-discipline transfer:** (a) *boundary object* — method whose citing papers span ≥2
   top-level FOS; (b) *transfer headroom* — method dominant in FOS-A, ~absent in FOS-B (HEALPix
   662→3). Rank by spread / headroom.

**Guardrail discipline that keeps this grounded:** ground on FOS codes + citation/dataset LINKS +
arXiv cross-listings; every candidate ships its **evidence anchor** (the counts ARE the
justification); the tool surfaces **leads for a human to judge**, never verdicts; and an LLM/agent
may **read the abstract** (returned by the API) to confirm "validated only on synthetic/benchmark
data" — turning a soft signal into a checked one (the agentic, Alien-gateway differentiator).

## RO-Crate Research Objects ARE in OpenAIRE (verified)

OpenAIRE indexes **RO-Crate research objects** — but not as a top-level type. They sit under
top-level `type="other"` with **`instance_type="Research Object"`** (the enum literal exists and
the filter genuinely applies: `type=other` alone = 39,168,671 → with the Research-Object filter =
**218,828**). That 218,828 bucket is *broad and noisy*, though — its top hits are Japanese KAKEN
"実績報告書" achievement reports, **not** RO-Crates. Add a topic keyword and real crates surface:

- `query="workflow"` + `instance_type=["Research Object"]` + `type=["other"]` → **77** results, and
  these are genuine RO-Crates, e.g. **`…__climate.rocrate.zip` by Anne Fouilloux** (2025-05-24),
  *"Research Object Crate for HiFi de novo genome assembly workflow"*, *"Metabolic Syndrome Pack for
  wf4ever"*, *"C-SCALE Workflow Solution: Automated monthly river forecasts using Wflow"*.
- `query="RO-Crate"` → 668, but mostly the **tooling** indexed as `software` (`ro-crate-py`
  `10.5281/zenodo.4349388`, `ro-crate-ruby`, `ro-crate-js`), not crates themselves.
- **WorkflowHub** (the canonical RO-Crate repository) is a registered OpenAIRE data source
  (`search_data_sources("WorkflowHub")` → id `fairsharing_::c8cd63e1bf13c5016881652983fb615a`).
  ⚠ But `rel_collected_from_datasource_id`/`rel_hosting_data_source_id` with that id returned **0** —
  the FAIRsharing registry id is not the harvesting datasource id used on products, so a clean
  WorkflowHub crate count could **not** be obtained live this session. Flagged, not claimed.

**Why it matters:** an RO-Crate bundles workflow + data + code + provenance into one citable object —
exactly the kind of first-class "reproducibility package" node the verified-knowledge layer and the
CoARA output-diversity angle both want. And one of Anne's own outputs already is one.

## The 2–3 most powerful tools

1. **`get_citation_network`** (+ its raw feed `explore_research_relationships`, 610 real edges) —
   the only call that returns a finished bidirectional, typed relationship graph around a DOI by
   fusing Graph v2 + ScholeXplorer. This **is** the verified-knowledge-graph primitive: render the
   neighborhood of a verified paper and show the Graph holds every edge *except* the verification
   edge the Radar adds (Jean's citation-graph facet). Direction (i).
2. **`get_author_profile` with `product_type=`** (+ `get_project_outputs`) — the CoARA engine: it
   splits an author's outputs by type (16 software/dataset of 104 for our anchor) and a project's
   outputs into publication/dataset/software counts, letting you assess by output *diversity* and
   reuse rather than citations (which read "0" across most outputs anyway). Direction (ii).
3. **`search_research_products` with `*_class` + `sort_by`** — the reliable impact-ranking path
   (the dedicated `find_by_*_class` tools are broken under a query). Confirms the four BIP! axes are
   genuinely distinct (Soroye is impulse C1 but influence only C3) and validates the Radar's
   ranking. Direction (iii). `get_research_product_details` is the best per-paper badge source.
