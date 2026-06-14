# CLAUDE.md — Replication Radar (project brief for Claude)

Read this before working. It's the heads-up for any Claude session on this repo.

## What this is
**Replication Radar** — a tool that makes the **OpenAIRE Graph more useful for replication**.
Search a research topic → impact-ranked papers worth replicating + whether each has been
independently checked (with the verdict) + a FAIR-software score for the replications.

- **Live web app:** https://openaire-hackathon.netlify.app (auto-deploys on push to `main`)
- **Also an MCP server** (`pip install replication-radar`) exposing the same engine to agents.
- **OpenAIRE AI Hackathon, Theme B (Build). CC-BY.** Deadline 2026-08-20; community vote 21–29 Aug.
- Authors: Anne Fouilloux (+ Jean Iaquinta, who owns a complementary citation-graph angle via the Alien-gateway MCP).

## Architecture
- `site/` — the **web app** (static: `index.html`, `app.js`, `style.css`, `verdicts.json`).
  Pure client-side; deployed by Netlify (`netlify.toml` → `publish = "site"`). **This is the main artifact.**
- `src/replication_radar/` — the **MCP server** (`server.py` = FastMCP; `radar.py`/`openaire.py`/`verdicts.py` = core). On PyPI.
- `scripts/build_verdicts.py` — rebuilds the bundled verdict index from local FORRT chains (fallback data).
- `STORY.md` — the 1–2pp CC-BY hackathon story. **STALE — needs rewriting** to match the current app (see Next).

## How the app works — all GROUNDED, all CORS-enabled, NO auth/keys
1. **Impact ranking** — public OpenAIRE Graph API `https://api.openaire.eu/graph/v1/researchProducts`
   (`type=publication|software|dataset`), `indicators.citationImpact` (BIP! classes C1=top 0.01% … C5).
   Dedup id = `doi_dedup___::md5(lowercased-doi)`. Free-text is AND-ed; keep queries short.
2. **Verdict overlay (author-agnostic, LIVE)** — SPARQL on `https://query.knowledgepixels.com/repo/full`.
   Two queries joined on the nanopub **trusty hash** (`STRAFTER(STR(?x),"/np/")`):
   - Outcomes: `?np ntpl:wasCreatedFromTemplate <https://w3id.org/np/RA2zljn0Nw9SadppOyxZoh-_Rxosslrq-vYG-p9SttnJE>` → `slt:hasValidationStatus` (Validated/PartiallySupported/Contradicted) + `slt:hasOutcomeRepository`.
   - CiTO: template `<https://w3id.org/np/RA43F9EoOuzF0xoNUnCMNyFsfIqlsuWDdPHCnN0wCdCAw>`; the CiTO's **subject is the Outcome np**, `cito:<rel>` → original DOI.
   (`ntpl: <https://w3id.org/np/o/ntemplate/>`, `slt: <https://w3id.org/sciencelive/o/terms/>`, `np: <http://www.nanopub.org/nschema#>`.) Bundled `verdicts.json` = offline fallback only.
3. **FAIR-software** — fair-software.eu 5 recs + usage, live from GitHub API + Software Heritage API
   (+ Zenodo API fallback to find the GitHub repo when OpenAIRE lacks `codeRepositoryUrl`). Only ever
   run on a replication we ACTUALLY have a repo URL for. GitHub unauth limit = 60/hr.

## GUARDRAILS — learned the hard way, do not violate
- **Grounded sources only.** Every signal must come from a real, named source (OpenAIRE / nanopub network /
  GitHub / SWH / Zenodo). We removed a keyword-matched "independent tooling" feature because it guessed
  relevance and surfaced off-topic repos — DO NOT reintroduce relevance-by-keyword-guessing.
- **Verify before building.** Probe an API live (curl / a Node snippet) BEFORE wiring it in. We wasted effort
  assuming F-UJI/OSTrails had usable APIs (they don't) and assuming KL DOIs were in OpenAIRE (they're not).
- **Never claim it "works" without running it.** Node-check `app.js` and test logic against the live API.
- **No unverifiable numbers on screen.** Don't display counts the tool can't stand behind.
- **Only assess software you have a real repo URL for** — never infer which tool fits a paper.

## OpenAIRE access
The web app needs **none** (public API). The Alien-gateway **MCP** (auth via OAuth) is agent-side only and
offers richer bibliometric / citation-relationship / co-author / dataset tools — useful for agentic
exploration and for Jean's citation-graph piece, but the app does not and should not depend on it (and a
public static site must never hold a token).

## Next (priority)
1. **Rewrite `STORY.md`** (stale) — honest, 1–2pp, structured: question / journey / insight / what others can
   reuse. Leave a slot for Jean's citation-graph evidence (e.g. Soroye 2020's citation graph lacks the
   verification edge — the gap the Radar fills).
2. Stress-test diverse topics for OpenAIRE data quirks (we already filter peer-review reports / dedup by title).
3. Optional: screencast/GIF for the vote.

## Conventions
- Git identity: `anne.fouilloux@lifewatch.eu`. **No `Co-Authored-By` trailer** in commits.
- Push to `main` → Netlify auto-redeploys. Keep `app.js` `node --check`-clean.
