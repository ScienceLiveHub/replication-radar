# Nanopub link-types — map of the connective layer

*Probe date: 2026-06-14. REPORT-ONLY: every count and link below was read live from the
network; nothing was built. Method per `CLAUDE.md`: grounded sources only, verified live.*

**Endpoint:** `https://query.knowledgepixels.com/repo/full` (SPARQL, GET `?query=`, no auth).
**Discovery method:** (1) re-confirmed the two proven templates; (2) fetched example nanopubs from
the Soroye/Bombus chain with `curl -L -H "Accept: application/trig" https://w3id.org/np/<hash>`
and read `ntpl:wasCreatedFromTemplate` in their pubinfo; (3) ran a network-wide template census of
everything created on `platform.sciencelive4all.org`; (4) labelled each template via `rdfs:label`;
(5) `COUNT(DISTINCT ?np)` per template **network-wide** (not just on-platform).

Prefixes: `ntpl: <https://w3id.org/np/o/ntemplate/>`, `np: <http://www.nanopub.org/nschema#>`,
`slt: <https://w3id.org/sciencelive/o/terms/>`, `cito: <http://purl.org/spar/cito/>`,
`npx: <http://purl.org/nanopub/x/>`, `hycl: <http://purl.org/petapico/o/hycl#>`.

> **Counts caveat (verified):** network-wide ≠ on-platform. e.g. Quote = **153** network-wide but
> 39 on-platform; CiTO-FORRT = **64** vs 34. The app queries the network by template, so the
> network-wide number is the one that matters. All counts below are network-wide as of the probe.

---

## The map

| Link-type | Template URI (hash) | Count (net) | Joins to | What it adds to the verified-knowledge graph |
|---|---|---:|---|---|
| **Quote** (paper annotation) | `RA24onqmqTMsraJ7ypYFOuckmNWpo4Zv5gsLqhXt7xYPU` | **153** | a **DOI** via `cito:hasQuotedText` + `cito:quotes`; `npx:hasNanopubType cito:cites` | Pins a *specific quoted sentence* of a DOI'd paper — the human entry point that anchors a claim to an exact passage. |
| **Claim (FORRT)** | `RAZWyM8D16ya3S1zhCvrG1f0iSpd9-8onVWp0FTvvX7LQ` | **32** | an **AIDA statement** via `slt:asAidaStatement`; *targeted by* a Study via `slt:targetsClaim` | The actual scientific assertion under test, *typed* (`statistical_significance-`, `model_performance-`, `descriptive_pattern-FORRT-Claim`…). The semantic content the OpenAIRE Graph structurally cannot hold. |
| **Claim (original, FORRT)** | `RAu5uTahAxc0OLBB3vaGwK3OQDDZV7QuWtDlBk0Ea3bco` | 6 | same as Claim(FORRT) | Variant template ("Declaring an original claim according to FORRT") — same role, smaller use. |
| **Replication Study** | `RAuLEjPp-4dTvPwMkfHggTto1CgjIftiGRAgHlyeEonjQ` | **37** | a **Claim np** via `slt:targetsClaim`; carries `slt:hasMethodologyDescription` / `hasScopeDescription` / `hasDeviationDescription`, `slt:hasDiscipline` → **wikidata** | The *method* of a replication attempt: what was done, scope, deviations from the original, discipline. |
| **Replication Outcome** ⭐*(in app)* | `RA2zljn0Nw9SadppOyxZoh-_Rxosslrq-vYG-p9SttnJE` | **39** | a **Study np** via `slt:isOutcomeOf`; a **repo DOI** via `slt:hasOutcomeRepository`; `slt:hasValidationStatus` (Validated / PartiallySupported / Contradicted), `slt:hasConfidenceLevel`, evidence/conclusion/limitations text | **The verdict** + confidence + evidence + the code/data repository. Already powering the Radar's overlay (39 = 25 validated / 11 partial / 3 contradicted). |
| **CiTO (FORRT)** ⭐*(in app — the join key)* | `RA43F9EoOuzF0xoNUnCMNyFsfIqlsuWDdPHCnN0wCdCAw` | **64** | subject = the **Outcome np**; `cito:<rel>` → **original paper DOI** | The edge that ties a verdict back to the *original* paper's DOI — how the overlay lands on the Graph. |
| **CiTO (generic)** | `RAX_4tWTyjFpO6nz63s14ucuejd64t2mK3IBlkwZ7jjLo` | **110** | subject = a **DOI** (`a fabio:ScholarlyWork`); `cito:<rel>` (e.g. `obtainsBackgroundFrom`) → another **DOI** | Typed **DOI↔DOI** citation/relation assertions ("Declare citations with CiTO"). General-purpose semantic citation edges. |
| **Research Software** ⭐*(in app — FAIR input)* | `RABBzVTxosLGT4YBCfdfNd6LyuOOTe2EVOTtWJMyOoZHk` | **43** | software **DOI** (`a dcmitype:Software`); `cito:supports` → **paper DOI** + **Claim np**; `schema:result` → **Outcome np**; `schema:maintainer` → **GitHub URL**; `skos:related` → **data DOIs** | Connects software ↔ paper ↔ data ↔ code-repo ↔ outcome. The richest single node: it already feeds the Radar's FAIR-software scoring (via the GitHub URL). |
| **AIDA sentence** | `RALmXhDw3rHcMveTgbv8VtWxijUHwnSqhCmtJFIPKWVaA` | **1279** | AIDA URI (`a hycl:AIDA-Sentence`); `cito:obtainsSupportFrom` → **DOI(s)** + URL; `schema:about` → **wikidata** | Atomic, machine-readable statements about research, each grounded to a DOI + wikidata concept. **By far the largest layer** — the "claim text at scale" substrate a model could cite. |
| **Research Synthesis** | `RApmrqOEr4f5bJC2vayrTnzhwnuEfAU_I4Pdg8K5JxeBw` | **4** | `cito:isSupportedBy` → **multiple nanopubs**; `dct:subject` → **wikidata**; recommendation/synthesis/conditions/limitations text | The meta-evidence node: "what does the *body* of results say" — aggregates many outcomes/claims into a recommendation. Powerful shape, but very sparse today. |
| **PICO research question** | `RA5e5XeXy_-aNK5giB7kBAEQslTLVydHeM4YYEzhmEE2w` | 25 | part of the systematic-review cluster (feeds a Synthesis) | The structured question behind a synthesis (Population/Intervention/Comparison/Outcome). |
| **PCC research question** | `RAmR-xqMgOq3oTJmOVDQFL2p5usID6zqRapizHy0UJb04` | 18 | same | Population/Concept/Context question variant. |

**Meta / non-domain templates** (present but not part of the knowledge graph): "Approving or
disapproving of a nanopublication" (`RAx2PsXN…`, 18) and "Commenting on something" (`RA3gQDMn…`, 11)
— generic `npx` social layer, noted for completeness only.

**No "Research Object" template exists *on the nanopub network*.** A network-wide census of `slt:`
entity *types* (below) returned no `Research-Object` type; the closest nanopub node is **Research
Software** (typed `dcmitype:Software`). Treat "Research Object" as *not yet a nanopub link-type*.

> **But RO-Crate Research Objects DO exist in OpenAIRE itself** (verified — see
> [`openaire-mcp.md`](./openaire-mcp.md)): top-level `type="other"`, `instance_type="Research
> Object"` (e.g. Anne's own `…climate.rocrate.zip`; WorkflowHub is a registered data source). So the
> *object* is reachable on the Graph side even though no nanopub *link-type* points to one yet — a
> gap the verified-knowledge layer could close (e.g. an RO-Crate ↔ Outcome/Claim nanopub link).

### Entity-type census (network-wide `a slt:<Type>`, distinct subjects)
Confirms the chain above and surfaces adjacent types not yet wired anywhere:
`FORRT-Claim` 57 · `FORRT-Replication-Outcome` 53 · `FORRT-Replication-Study` 44 ·
`Replication-Study` 27 · `computational_performance-FORRT-Claim` 21 ·
`EffectivenessResearchQuestions` 18 · `PccReviewQuestion` 18 · **`Reproduction-Study` 14** ·
`model_performance-FORRT-Claim` 14 · `descriptive_pattern-FORRT-Claim` 9 ·
`SystematicDatabaseSearch` 8 · `ConfidenceLevel`/`ValidationStatus` 5 each ·
`Research-Synthesis` 4 · `SearchExecutionDataset`/`StudyAssessmentDataset`/
`SystematicReviewSearchStrategy` 3 each · `data_governance-`/`data_quality-FORRT-Claim` 3 each ·
`scalability-FORRT-Claim` 2 · `Reproduction-Replication-Study` 1 · `ScienceLiveCredit` 1.

---

## The join graph (how the link-types chain)

```
            cito:quotes / hasQuotedText
   Quote  ─────────────────────────────▶  DOI (original paper)
                                            ▲
                                            │ cito:<rel>   (CiTO-FORRT: subject = Outcome np)
   Claim  ◀── slt:targetsClaim ──  Study  ─┼─ slt:isOutcomeOf ─▶  Outcome
     │                                      │                      │ slt:hasValidationStatus → Validated/Partial/Contradicted
     │ slt:asAidaStatement                  │                      │ slt:hasOutcomeRepository → repo DOI
     ▼                                      │                      ▲
   AIDA ── cito:obtainsSupportFrom ▶ DOI    │                      │ schema:result
                                            │                      │
                            Research Software ── cito:supports ▶ paper DOI + Claim
                                            └── schema:maintainer ▶ GitHub repo (→ FAIR score)

   Research Synthesis ── cito:isSupportedBy ▶ { many nanopubs }     (meta-evidence aggregator)
```

**Join keys (all verified live on the chain):**
`Outcome →(slt:isOutcomeOf)→ Study →(slt:targetsClaim)→ Claim →(slt:asAidaStatement)→ AIDA`;
`Outcome ←(subject)← CiTO-FORRT →(cito:rel)→ original DOI`;
`Software →(cito:supports)→ paper DOI & Claim`, `→(schema:result)→ Outcome`, `→(schema:maintainer)→ GitHub`.

**What the app already traverses:** Outcome + CiTO-FORRT (verdict→DOI), and Research Software→GitHub
(FAIR). **What is one hop away and unused:** the **Claim** (`Study→targetsClaim`) and its **AIDA**
statement — i.e. *what was actually tested*, which today's overlay never shows.
