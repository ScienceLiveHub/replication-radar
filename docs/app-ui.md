# Replication Radar — web app UI spec

*2026-06-14. Spec for the live app (`openaire-hackathon.netlify.app`, served from `site/`). Proposal
— not built yet. Grounded on [`next-layers-plan.md`](./next-layers-plan.md),
[`openaire-mcp.md`](./openaire-mcp.md), [`link-types.md`](./link-types.md). Re-verify counts/APIs
before building.*

## 0. What the app is for

It embodies one researcher journey: **Discover → Assess → Replicate → Extend**, with
**verification woven through** (the replication verdict is the trust signal that powers Assess, and
the thing Extend produces). The app is the Discover + Assess surface and the launchpad into Replicate
(the `forrt-replication-template`) and Extend (publishing a nanopub chain).

## 1. Two surfaces (driven by the auth constraint)

The OpenAIRE **MCP needs OAuth** and the static site **must hold no token**. So:

- **Live search (any topic)** — runs in-browser on **public CORS APIs**: OpenAIRE Graph REST +
  nanopub SPARQL (`query.knowledgepixels.com`) + GitHub/Software Heritage. Open-ended, always fresh.
- **Curated demo walkthroughs** (e.g. HEALPix astro→EO; EuroSAT benchmark→real-world) — precomputed
  via the **MCP at curation time, baked to static JSON** (the existing `verdicts.json` pattern).
  Carries what the browser can't fetch live: the citation-graph "missing edge" view and
  cross-discipline transfer-headroom. This is the polished artifact for the 21–29 Aug community vote.

**Rule:** anything sourced only from the MCP is **baked**; anything on a public CORS API is **live**.

## 2. Screen 1 — Discover + Assess (main view)

```
┌──────────────────────────────────────────────────────────────────────┐
│  Replication Radar          [ search: your topic / question / domain ]  │
│                             domain (FOS): [ Earth sciences ▾ ]          │
│  Sort:  ⦿ Replication-ready  ○ Recency  ○ Impulse  ○ FAIR  ○ Verdict   │
├──────────────────────────────────────────────────────────────────────┤
│ ⭐ DeepSphere — spherical CNN with HEALPix sampling                     │
│    paper+software linked · 2019 · impulse C3 ▲ rising · FAIR 4/5        │
│    STATUS: Replication-ready, unreplicated   [ 🧬 code ][ 📦 data ]      │
│    → astrophysics method · 3/662 uses in Earth science (headroom)       │
│    [ Inspect ]                          [ ▶ Start a replication ]        │
├──────────────────────────────────────────────────────────────────────┤
│ ✅ Soroye 2020 — bumble-bee thermal extirpation                         │
│    VALIDATED replication · verdict ↗ nanopub · influence C3 · 593 cites │
│    [ Inspect ]                          [ ▶ Extend this chain ]          │
├──────────────────────────────────────────────────────────────────────┤
│ 💤 <older method> — 2009 · 16 yrs · no code linked · unreplicated        │
│    STATUS: Dormant-unchecked                                            │
└──────────────────────────────────────────────────────────────────────┘
```

Each result card shows: **status badge** (§5 taxonomy), **year** badge, **impact** chips (BIP!
influence/popularity/impulse classes), **FAIR** score (if code), **readiness icons** (code / data /
RO-Crate), and — for cross-discipline hits — the **transfer-headroom** one-liner. Two CTAs: *Inspect*
and *Start a replication* / *Extend this chain*.

## 3. Screen 2 — Inspect (flagship: "missing edge" + transfer + claim)

```
┌──────────────────────────────────────────────────────────────────────┐
│  DeepSphere (10.1016/j.ascom.2019.03.004)                              │
│  Claim:  "spherical CNNs on HEALPix enable analysis of sphere-mapped   │
│           data" — tested in: cosmology                                  │
│   citation neighborhood (OpenAIRE)        ┌─ verification edge ─┐       │
│      ● ── cites ── ●   ● ── ●             │  ✗ none yet          │      │
│          ● DeepSphere ●  ╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌╌▶│  ⭐ you could add it  │      │
│      ● software (FAIR 4/5)  ● data        └─────────────────────┘       │
│  Cross-discipline headroom:  Earth sci 3 ▏ Astrophysics 662 ████████   │
│     existing crossover: "Deep Learning Weather Prediction on HEALPix"   │
│  Every figure links to its source ↗ OpenAIRE · ↗ nanopub · ↗ GitHub     │
│  [ ▶ Start a replication in my domain → forrt-replication-template ]     │
└──────────────────────────────────────────────────────────────────────┘
```

This screen *is* the thesis: the OpenAIRE links are present, the **verification edge is visibly
absent** ("nobody checked this — you could"), the **headroom bar** dramatizes 662-astro vs 3-earth,
and the button hands the user to the producer template (loop closes). For an already-validated paper,
the same view shows the verification edge **present and highlighted**, sourced to the signed nanopub.

## 4. Data-source map

| Element | Source | Live / baked |
|---|---|---|
| Ranked candidates, impact classes, year, FOS | OpenAIRE Graph REST | **live** |
| Verdict badge + claim (Claim/AIDA) + nanopub link | nanopub SPARQL | **live** |
| FAIR-software score | GitHub + SWH APIs | **live** |
| Readiness icons (code / data / RO-Crate) | OpenAIRE links + `instance_type="Research Object"` | live where public; **baked** if MCP-only |
| Citation-graph "missing edge" view | `get_citation_network` (MCP) | **baked** |
| Cross-discipline transfer-headroom | `search_research_products` + `fos` (MCP) | **baked** |
| "Start a replication" / "Extend" CTA | link to `forrt-replication-template` (+ `/radar`) | static link |

## 5. Status taxonomy (how each badge is computed — all grounded)

"Not replicated" is **ambiguous** and must be disambiguated, not penalised:

| Badge | Rule (grounded signals) |
|---|---|
| ✅ **Validated** | a validated Outcome nanopub joins to this DOI |
| ⚠️ **Contested** | a contradicted/partial Outcome joins to this DOI |
| ⭐ **Replication-ready, unreplicated** | no Outcome **AND** paper↔software(+data)/RO-Crate linked **AND** recent / high impulse |
| 🔧 **Unreproducible-as-is** | no Outcome, no linked code/data |
| 💤 **Dormant-unchecked** | no Outcome, old (high age), low impulse, no materials |

`materials = paper↔software link OR nanopub Research-Software node OR RO-Crate` (RO-Crate = strongest).

## 6. Prioritisation = transparent facets (evolving the existing `readiness`)

> The app already has a `readiness` score (`app.js:213`) and sorts by it. The facets below **evolve**
> that score — per-paper link-verified materials (with an "unknown ≠ absent" state), status taxonomy,
> recency/impulse, shown as a breakdown. Full design + build phases: [`readiness-scoring-plan.md`](./readiness-scoring-plan.md).

User picks the sort; each facet is defensible and visible:
- **Recency** — from publication year → **age**; used to *interpret* unreplicated status, not as raw
  "newer=better". Pair with impulse, **don't double-count** (impulse already recency-normalizes).
- **Impulse** (BIP! early-citation momentum) — "rising now".
- **Replication-readiness** — materials linked? (the ⭐ bucket floats up).
- **FAIR** — reusable code present?
- **Verdict** — validated / contested / none.
- **Missing data handling:** many records have `Date: N/A` / no DOI (verified live) — mark
  "date unknown", never silently treat missing as old or penalise metadata gaps.

## 7. Guardrails for the UI

- Every number links to its named source (OpenAIRE record / nanopub URI / GitHub). No orphan stats.
- No black-box composite score — transparent sort facets only.
- Cross-discipline panel **always** shows its evidence anchor (the FOS counts + the real existing
  crossovers). Never a keyword-similarity guess (the deleted-feature anti-pattern).
- FAIR runs only where a real repo URL resolves; show "no code linked" honestly otherwise.

## 8. The baked static-JSON contract (curation → app)

Curation-time MCP run emits one file per curated candidate (or one bundle), shape ~:

```jsonc
{
  "doi": "10.1016/j.ascom.2019.03.004",
  "title": "DeepSphere …", "year": 2019,
  "type": "publication",
  "claim": { "text": "spherical CNNs on HEALPix …", "tested_in": "cosmology",
             "nanopub": null },                         // or a signed URI if it exists
  "impact": { "influence": "C3", "popularity": "C3", "impulse": "C3" },
  "materials": { "software": ["…doi/github"], "data": ["…doi"], "ro_crate": false },
  "fair": { "score": 4, "of": 5, "repo": "https://github.com/…" },
  "verdict": null,                                       // {status, nanopub} when replicated
  "status": "replication_ready",
  "neighborhood": { "nodes": [...], "edges": [...],      // from get_citation_network
                    "verification_edge": null },         // present|null → the highlight
  "transfer": { "method": "HEALPix", "from_fos": "astrophysics", "from_count": 662,
                "to_fos": "earth sciences", "to_count": 3,
                "crossovers": ["Deep Learning Weather Prediction on the HEALPix Mesh"] }
}
```

Mirrors how `verdicts.json` is already produced (`scripts/build_verdicts.py`); add a sibling builder
that calls the MCP for `neighborhood` + `transfer`.

## 9. Build phasing (mapped to `site/`)

1. **MVP** (extends the current results table in `app.js`): status badges + readiness icons + year +
   transparent sort facets + claim line. Mostly from APIs already wired + one extra SPARQL hop.
2. **Flagship** (`Inspect` view, baked): the citation-graph "missing edge" panel for the curated set.
3. **Headline** (baked): the cross-discipline transfer-headroom panel.
4. **Polish**: screencast/GIF for the vote; README; CC-BY.

Keep `app.js` `node --check`-clean; push to `main` → Netlify redeploys (per `CLAUDE.md`).
