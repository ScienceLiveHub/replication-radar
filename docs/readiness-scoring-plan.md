# Readiness scoring — evolve the existing skeleton (demo plan)

*2026-06-14. Plan only. The app ALREADY scores replicability and sorts most-replicable first; this
doc evolves that, it does not invent it. Baseline = `site/app.js`. Demo-oriented.*

## 1. Baseline (what the code does today — verified, `app.js:213/222`)

```js
readiness = 0.5 * classScore(p)        // impact: max(influenceClass, citationClass), C1=1 … C5=0.2
          + 0.3 * (tools.length > 0)   // topic has ≥1 independent, reused tool (reuse≥2)  → 0/1
          + 0.2 * hasData              // topic has ≥1 dataset in OpenAIRE                 → 0/1
targets.sort(readiness desc, then citations)   // shown with the "REPLIC." badge
```

**Three weaknesses to fix:**
1. **Impact-dominated** — half the score is BIP! impact; materials are secondary.
2. **Topic-level proxies, not per-paper** — `tools`/`hasData` describe the *search topic*, not *this
   paper*. A paper scores +0.5 for materials its topic has but it may not. (This is the WiSDM trap:
   *relevance ≠ readiness* — WiSDM had a real R repo + open data but **0 links in OpenAIRE**.)
3. **Black-box & blind to recency/status** — one opaque number; no year, no impulse, no
   replicate-status taxonomy; "not replicated" isn't disambiguated.

## 2. Target design

### 2a. Per-paper materials signal — with an explicit "unknown" state (the WiSDM fix)

Materials must be **per-paper and grounded**, and must NOT penalise a paper just because OpenAIRE
lacks the link (absence in the graph ≠ absence in reality). Three states:

| Materials state | Detected from | Score contribution |
|---|---|---|
| **verified-present** | per-paper link to software/dataset, or `codeRepositoryUrl`, or an **RO-Crate** (`instance_type="Research Object"`), or (baked) repo resolved from the paper's Data/Code statement | RO-Crate 1.0 · code+data 0.8 · code-or-repo 0.6 · data-only 0.3 |
| **verified-absent** | record present, no links, old, no repo field | 0.0 |
| **unknown (not in graph)** | OpenAIRE has no link AND we haven't resolved the paper | **null — not 0**; flag "materials unverified", offer the agent/baked resolve step |

> Live mode uses what the public API exposes per-paper (relations where present + `codeRepositoryUrl`)
> and marks the rest **unknown**; the curated demo set is fully resolved (baked) — repo from the
> paper, FAIR score, RO-Crate flag. Never silently treat "unknown" as "absent."

### 2b. Status taxonomy — the Assess headline (primary sort key)

Computed per paper from grounded signals (verdict overlay + materials + year/impulse):

| Status | Rule |
|---|---|
| ✅ **Validated** | a validated Outcome nanopub joins this DOI |
| ⚠️ **Contested** | a contradicted/partial Outcome joins this DOI |
| ⭐ **Replication-ready** | no verdict **AND** materials verified-present (≥0.6) **AND** recent / high impulse |
| 🔧 **Unreproducible-as-is** | no verdict **AND** materials verified-absent |
| 💤 **Dormant-unchecked** | no verdict, old, low impulse, materials absent/unknown |
| ❔ **Needs check** | materials **unknown** — candidate for the resolve step (don't bury it) |

### 2c. Transparent composite (shown with its parts, not a black box)

```js
readiness = 0.45 * materials      // per-paper (2a); null→excluded & flagged, not 0
          + 0.35 * classScore     // BIP! impact (kept, demoted from 0.5)
          + 0.20 * momentum       // CLASS_SCORE[impulseClass]  (NEW: momentum, not raw recency)
```
- **Materials is now the largest term** (fixes impact-domination).
- **Impulse** replaces citation-count as the momentum signal (recency-normalized; don't add raw year
  on top — year is a status disambiguator + badge, §2b, not a composite term).
- **Sort:** group by **status** (⭐ Replication-ready surfaced first for a replicator; ✅ Validated as
  "solid — extend"), then `readiness` desc within group. The card shows the 3-part breakdown + a year
  badge; every part links to its source. Keep the "REPLIC." number for continuity.

## 3. Build phases (mapped to `app.js`; keep `node --check` clean)

- **P0 · Honesty fix (live, cheap):** replace topic-level `tools`/`hasData` with the per-paper
  materials signal (2a) incl. the **unknown** state; add **year** badge + **impulse**; show the score
  breakdown. Demote impact weight. ← *this is the first fix; it removes the WiSDM-style false readiness.*
  **✅ DONE 2026-06-14** (`site/app.js` + `style.css`): composite
  `0.45·materials + 0.35·impact + 0.20·momentum`; materials per-paper with `unknown`(null) renormalised
  (never scored 0); year/impulse/materials badges + breakdown tooltip. Verified — `node --check` clean,
  logic tested vs a live OpenAIRE record + mocks, readiness ∈ [0,1] across all class combos. **Not pushed.**
  Honest finding: in live mode **most real publications return materials=`unknown`** (OpenAIRE rarely
  holds code links on pubs — the WiSDM rule), so the visible `code ✓`/`RO-Crate ✓` payoff arrives with
  **P2 baked resolution** of the curated demo set.
- **P1 · Status taxonomy (live):** compute & group by status; surface ⭐ Replication-ready.
- **P2 · Curated demo enrichment (baked-to-static):** for the demo set resolve materials fully (repo
  from paper, FAIR, RO-Crate, citation-network "missing edge", transfer-headroom). See `app-ui.md` §8.
- **P3 · Close the loop:** "Start a replication" → `forrt-replication-template` (scoped) → publish
  chain → re-search shows the paper flip to ✅ Validated.

## 4. Demo script (the artifact for the 21–29 Aug vote)

Worked example = **Reproducible WiSDM** (`10.3389/fevo.2024.1148895`) — found via OpenAIRE search,
materials verified from the paper: R repo `github.com/trias-project/risk-modelling-and-mapping`, open
data (GBIF / CHELSA / EURO-CORDEX / CORINE).

1. **Discover** — search *"invasive species climate"* → ranked list. WiSDM rises as **⭐
   Replication-ready** (materials verified, recent, unreplicated, impulse C4).
2. **Assess** — open the score breakdown: *materials 0.8 (R repo + open data) · impact C5/C4 ·
   momentum C4*. Punchline: **OpenAIRE holds none of these material edges — the link is what we add.**
3. **Replicate** — "Start a replication" → fork the template, scoped to **one species / one region /
   one SSP scenario** to stay fast; `/radar` confirms nobody's done it.
4. **Extend** — publish the FORRT chain; re-search → WiSDM flips to **✅ Validated**, the verification
   edge now present. **Loop closed, live.**

(Fallback proof if a fresh replication can't finish in time: the already-published **Soroye/Bombus**
chain demonstrates the full loop end-to-end — see [[sciencelive-ecosystem]].)

## 5. Guardrails (unchanged, enforced)

Grounded sources only; **"unknown" ≠ "absent"** (the WiSDM rule); transparent breakdown not a
black-box number; materials are per-paper links/resolved repos, never topic-name matching (the
deleted-feature trap); FAIR only where a real repo resolves; never label untested code "works".
