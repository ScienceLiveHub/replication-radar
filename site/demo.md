This page reproduces the [3-minute demo video](https://youtu.be/hVyLafY3Y3E) **step by step** — the exact searches, prompts, and expected results, so you can run the same discover-and-find flow yourself. Everything here is **grounded and deterministic**: the same query returns the same ranked result, because it all comes from live public data (the OpenAIRE Graph and the Science Live nanopublication network), never from a model's memory.

The demo has **two halves**, exactly as in the video:

- **Part A — the web app** *(no install, ~1 minute)*: browse a field and read the two signals the OpenAIRE Graph can't hold — *has this claim been checked?* and *is its software reusable?*
- **Part B — the agent** *(the criterion-#1 core)*: the same engine as an **MCP**, run **beside the OpenAIRE MCP**, driving an end-to-end discovery — from an un-replicated paper to the independent software and independent data to replicate it, then the scaffold.

---

## Part A — the web app (`species distribution`)

No account, no keys. Open **[openaire-hackathon.netlify.app](https://openaire-hackathon.netlify.app)** and follow along.

1. **Search a field.** Type **`species distribution`** in the box and hit **Scan**. The Radar queries the OpenAIRE Graph live and ranks the field's high-impact work.
2. **Read the verdict overlay.** On a **VERIFIED** card, see whether the claim was **independently checked** and how it held up — a signed Science Live verdict (*validated · qualifies · refuted*), overlaid live from the nanopublication network. This is *checked / not-checked*, the signal citations can't give you.
3. **Open the signed record.** Click a verdict to open its **nanopublication** — the **outcome**, **its evidence**, and the fact that it's **cryptographically signed**. Nothing is taken on trust; every verdict traces to a signed record.
4. **See the honest limits.** Each card shows its **limitations** — scope, method, coverage — read from the record, not glossed over.
5. **Spot the gap.** A **high-impact** target with **no materials** scores **0** on reusability — exactly the replication opportunity the Radar is built to surface.
6. **Assess the software, live.** On a card with code, expand **FAIR software** and the **RSE practices** fold: **documented · tested · CI**, plus **Software Heritage** archival — each check computed live from GitHub / Software Heritage / Zenodo and linked to the **real artefact**. This is the work of research software engineers, made visible.
7. **Start a replication.** Hit **Replicate this** on a target → you land on the **[how-to](replicate.html)**, scaffolded by the **FORRT replication template** and the **replication-radar MCP**. That hands you off to Part B.

---

## Part B — the agent (two MCPs, end to end)

This is the heart of the demo: an AI agent running the **`replication-radar` MCP** *next to* the **OpenAIRE MCP**, so it gets both the structural graph **and** the verification-and-reuse layer on top. The video uses **[Claude Code](https://claude.com/claude-code)**, but any **MCP-capable agent** works (Codex CLI, Gemini CLI, Cursor, VS Code, …) — the tool calls are identical.

### Set up (one time)

**You'll need** an MCP-capable agent and the two servers connected. The `replication-radar` MCP needs **no login and no key** (public sources only); the OpenAIRE MCP uses OAuth.

```bash
# the replication-radar MCP — pick one:
pipx run replication-radar        # isolated, no install
uvx replication-radar             # isolated, no install (needs uv)
pip install replication-radar     # into your environment
```

Use **`replication-radar` ≥ 0.4.5** for the scaffold step (`pipx upgrade replication-radar` to be sure). Add it to your agent — for Claude Code:

```bash
claude mcp add replication-radar -- replication-radar
```

Then, in the agent, confirm **both** servers are connected:

```
/mcp
```

You should see **`replication-radar`** and the **OpenAIRE MCP** listed. *(Full per-client setup — Cursor, VS Code, Codex, Gemini — is on the [how-to page](replicate.html).)*

### Run the discovery (paste each prompt, pause after each)

Naming the MCP in your question — *"use the replication-radar MCP…"* — guarantees the agent calls the tool instead of answering from memory.

1. **What's un-replicated?** Paste:
   > Use the replication-radar MCP: search "marine heatwave" — what high-impact paper hasn't been replicated yet?

   → the **`radar`** tool fires and ranks the field impact-first. The standout: **Oliver et al. 2018**, *"Longer and more frequent marine heatwaves over the past century"* (DOI [`10.1038/s41467-018-03732-9`](https://doi.org/10.1038/s41467-018-03732-9), ~1,760 citations) — flagged **high-impact but un-replicated**. A target, not a verdict.

2. **Confirm the gap.** Paste:
   > Has Oliver 2018 (DOI 10.1038/s41467-018-03732-9) been independently replicated?

   → **`replication_status`** reads the network live and returns **open** — no verdict yet. This is the gap we fill.

3. **Find independent, reusable software.** Paste:
   > Use the replication-radar MCP: find independent, reusable software for "marine heatwave" I could pick up to do this.

   → **`find_independent_software`** ranks **XMHW** (Petrelli — an independent implementation of Hobday 2016; [`zenodo.7662469`](https://doi.org/10.5281/zenodo.7662469), **31★**, repo resolved from Zenodo) **#1** by GitHub-star reuse, above one-off study repos. The author's own `marineHeatWaves` is correctly **excluded** (not author-disjoint) — but it's the perfect independent cross-check. *This surfaces the detector **before** you run — so you use the tool the Radar found, not one picked off-screen.*

4. **Find independent data — hand off to the OpenAIRE MCP.** The rigor beat: the original used HadISST, and ERA5 *prescribes* HadISST/OSTIA, so ERA5 wouldn't be independent. Paste:
   > Use the OpenAIRE MCP: find an INDEPENDENT sea-surface-temperature dataset for this — the original used HadISST, and ERA5 prescribes HadISST/OSTIA, so ERA5 wouldn't be independent.

   → the **OpenAIRE MCP** returns **ESA CCI SST L4** (satellite, genuinely independent; DOI [`10.5285/4a9654136a7148e39b7feb56f8bb02d2`](https://doi.org/10.5285/4a9654136a7148e39b7feb56f8bb02d2)). Now both MCPs are visible side by side: `replication-radar` found the **paper and the software**, OpenAIRE found the **independent data** — all traceable on one Graph.

   > **Honest boundary.** Satellite SST only reaches back to ~1982, so this can validate the paper's **satellite-era** trend; its century-scale figure stays out of scope (no independent pre-1981 daily record exists, for anyone). The video shows this caveat on screen — keep it in your narration.

5. **Scaffold the replication.** Paste:
   > Use the replication-radar MCP: set me up to replicate this — suggest an available repo name under my GitHub account and give me the create command.

   → **`replication_template`** returns a ready **`quickstart.create_repo`** command with a free `<topic>-replication` name pre-filled:
   ```bash
   gh repo create marine-heatwave-replication \
     --template ScienceLiveHub/forrt-replication-template --clone
   ```
   The agent **runs it → the repo is created and cloned** from the FORRT template, which records the paper · data · software. **This is where the video ends** — the loop's discovery half closes on a ready-to-run scaffold.

---

## From here — run the science

The demo *sets up* the replication; running it (pulling the ESA CCI SST, detecting events with XMHW, cross-checking against the author's own code, publishing the signed FORRT chain) happens in a **fresh agent session opened inside the new repo** — its operating manual (`AGENTS.md` / `CLAUDE.md`), slash commands, and `.mcp.json` load when the session *starts* there.

We ran it to the end. The finished, independent replication — **VALIDATED** in both data and code — is public:

- **The reproducible study:** [github.com/annefou/marine-heatwave-replication](https://github.com/annefou/marine-heatwave-replication) (code + data, Zenodo-archived).
- **The signed proof + the story, retold for citizens and for schools:** the [marine-heatwave story on Science Live](https://platform-dev.sciencelive4all.org/np/story?uri=https%3A%2F%2Fw3id.org%2Fsciencelive%2Fnp%2FRAQfGMNmJiFt4KDDJE8dsiT3az4CRYehRuDFoa-tXGc8w) and its [signed story nanopublication](https://w3id.org/sciencelive/np/RAQfGMNmJiFt4KDDJE8dsiT3az4CRYehRuDFoa-tXGc8w).

That published replication now reappears on the Radar as **independently checked** — closing the loop for the next person.

---

**[Watch the video ▶](https://youtu.be/hVyLafY3Y3E)** &nbsp;·&nbsp; [The full how-to guide](replicate.html) &nbsp;·&nbsp; [Find a target on the Radar](index.html) &nbsp;·&nbsp; [replication-radar on PyPI](https://pypi.org/project/replication-radar/)
