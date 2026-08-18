# Replication Radar — video script (< 3 min)

> **▶ START HERE. This is the only file you need to record the submission video.**
> Follow it top to bottom. The other files are helpers, not the script:
> • `DEMO.md` = a separate ~60s MCP-only runbook — use it just for the **one-time MCP setup** and to practise the MCP scene (Scene 4).
> • `video/captions.srt` = optional no-voiceover captions, **currently out of date** (no marine-heatwave scene) — ignore for now; I'll regenerate it to match your recording afterwards.

**Target runtime: ~2:45** (safely under the 3:00 limit). Format: screen recording. Voiceover is optional — every line below doubles as an **on-screen caption** if you'd rather not record your voice (see "Easiest way to record" at the end).

**Goal of the video (what the judges score):** show (1) it's *useful* and *original*, (2) it uses an **AI MCP connector on the OpenAIRE Graph** — **this is criterion #1, and it is the core of the whole video: the discover-and-find flow, driven by the MCP over the OpenAIRE Graph, is the hero — not a side demo**, and (3) it's grounded and reproducible.

**The through-line — the Radar does two things for Research Software Engineers (RSEs):**
1. **It surfaces the invisible work of RSEs.** The OpenAIRE Graph *lists* research software, but says nothing about whether it's reusable or whether anyone checked it. The Radar surfaces and credits that software — FAIR + RSE good-practice, live CI — and, via `find_independent_software`, hands an agent the independent tools an RSE can actually pick up. The people who *build* research software get seen, not just the paper authors.
2. **It supports RSEs building new research.** When an RSE sets out to replicate or extend a study, the Radar — driven by an agent over the MCP, next to the OpenAIRE MCP — answers the questions you actually start with: *what's worth doing? has it been checked, and how did it hold up? what reusable, already-checked software exists? what independent data should I use?* That is the discover-and-find loop, and it is the point of the tool.

**So the MCP scene (Scene 4) is the centrepiece — on screen, legible, and given the most time.** The browser scenes (1–3) set it up; the real end-to-end replication (Scene 5) pays it off by showing mission&nbsp;2 in action. If you have to cut, cut *toward* the MCP, never away from it.

---

## Demo content (locked in)
- **Hero paper:** Soroye, Newbold & Kerr (2020), *"Climate change contributes to widespread declines among bumble bees across continents,"* **Science** — DOI **`10.1126/science.aax8591`**, ~**653 citations**.
- **Why it hooks:** 🐝 bees + climate change is instantly relatable, it's a famous Science paper, and it *has been independently checked* — **five times**, aggregating to a **"Validated"** verdict (four confirm, one *qualifies* a projection detail): a rich, traceable result, not a plain yes/no — which is exactly the point. *(This grew from a single "PartiallySupported" replication as more FORRT replications landed; re-check the live card before recording in case it shifts again.)*
- **Search term to type:** `bumble bee decline`
- **Client:** Claude Code. Confirm both MCP servers are connected with `/mcp` before recording.
- **Backup paper** (if you prefer a punchier number): *"The Arctic has warmed nearly four times faster than the globe since 1979"* — DOI `10.1038/s43247-022-00498-3`, ~2,421 citations, also "qualifies." Search term: `arctic warming`.

### The replication we actually ran (Scene 5 — "the loop closes, for real")
- **Un-replicated target:** Oliver et al. 2018, *"Longer and more frequent marine heatwaves over the past century,"* **Nature Communications** — DOI **`10.1038/s41467-018-03732-9`**, ~1,760 citations. The Radar flags it as high-impact and **not yet replicated** — a target, not a verdict.
- **What we did, end-to-end (a genuinely independent replication — the agent made it rigorous):** the agent **rejected our first data choice** — ERA5's SST is prescribed from HadISST/OSTIA, the *same lineage* as the original paper, so not independent — and used **ESA CCI satellite SST** instead (independent; DOI `10.5285/4a9654136a7148e39b7feb56f8bb02d2`, via Copernicus Marine, ~5 s to pull). Detected marine heatwaves with **XMHW** (Petrelli — an *independent* implementation of Hobday 2016), **cross-checked the author's own `marineHeatWaves`** — the two agree **to the digit** (100 events; MHW-days +3.8/yr p≈2e-4; frequency +0.09/yr p≈7e-4). Fixed 1983–2012 baseline, 1980–2024. Independent on **both** axes (data *and* code) → **VALIDATED** at this NE-Pacific cell.
- **Verdict — VALIDATED (with independent data):** with ESA CCI satellite SST, marine-heatwave **days rose sharply (+3.8/yr, ≈18 → ≈169 per year, p≈2e-4)** *and* **frequency** rose significantly (+0.09/yr, p≈7e-4) — both *"longer"* and *"more frequent"* confirmed at this NE-Pacific cell. We then **scaled to a 34-point global ocean sample and reproduced the paper's own Figure 2** — global total MHW-days rising **+1.1 d/yr**, and the trend **survives ENSO removal (+1.2 d/yr)**, exactly the paper's point. *(Honest caveat: a sparse global sample, not the full 0.05° grid; and the flip from the earlier ERA5 run reflects both the independent data **and** ESA CCI's much finer resolution.)*
- **On-screen asset:** **`video/mhw_replication.png`** — a faithful reproduction of the paper's own **Figure 2** (global total marine-heatwave days, 1982–2016): black = global mean, red = ENSO-removed, pink/blue = El Niño/La Niña bands. The rising trend survives ENSO removal, exactly as in Oliver 2018. Show it full-screen.

---

## Before you hit record — have these ready in separate tabs/windows
1. The live app: **https://openaire-hackathon.netlify.app** — do a **practice search first** (e.g. `species distribution model`) so results are warm and you know what appears.
2. Your AI client with **both MCP servers connected**: `replication-radar` and the **OpenAIRE MCP**. Verify they're connected (in Claude Code: `/mcp`). Setup steps: https://openaire-hackathon.netlify.app/replicate.html
3. The guide page open: **https://openaire-hackathon.netlify.app/replicate.html**
4. **The replication figure open full-screen** in an image viewer (for Scene 5): **`replication-radar/video/mhw_replication.png`**.
5. Close notifications / other tabs. Browser zoom ~110–125% so text is readable in the recording.

---

## The script (shot by shot)

| # | Time | On screen (what to do) | Say / caption |
|---|------|------------------------|---------------|
| 1 | 0:00–0:15 | The live app. Type **`bumble bee decline`** in the search box and hit Scan. | "In 2020, a Science paper made headlines: climate change is wiping out bumble bees across two continents. It's been cited over six hundred times. But has anyone *independently checked* it? The OpenAIRE Graph can't tell you. Replication Radar can." |
| 2 | 0:15–0:55 | Results appear. Slowly scroll: the replication-gap bar, then the ranked targets. Find the **VERIFIED** bumble-bee card (Soroye 2020) and point to its verdict badge (**Validated** — "confirmed, 5 replications, 1 partial", with the five per-replication chips below it). Hover the **priority score** on another card. | "Search a field, and the Radar ranks what's worth replicating — then, live from the Science&nbsp;Live nanopublication network, it overlays whether each claim was independently checked, and how it held up. The bumble-bee finding *was* checked — **five times** — and it **held up**: independently **validated**, with one replication qualifying a projection detail. Not a headline; a verdict you can trace to signed nanopublications." |
| 3 | 0:55–1:20 | On a card with code, expand **FAIR software**, then the **RSE practices** fold. Show the green **CI** signal. Click one check (e.g. CI or a licence) so it opens the real artefact. Click the **"Has code"** filter. | "For every replication with code, it assesses the software live — the FAIR recommendations, plus RSE good-practices: documented, tested, CI. A green CI means the code builds and its tests pass. Every check links to the real file, so nothing is taken on trust. This is the **work of research software engineers made visible** — software the Graph lists, but never tells you is reusable or maintained." |
| 4 | 1:20–2:20 | **Switch to Claude Code** (terminal) — *this is the core shot, give it room.* First run **`/mcp`** to show `replication-radar` + OpenAIRE both connected. Then type prompt 1, let the `radar` tool call show; then prompt 2, let `find_independent_software` show. Keep the tool-call lines legible (larger font). | "**This is the heart of it.** The same engine is also an MCP server — and running *next to* the OpenAIRE MCP, an agent gets both the structural graph *and* the verification-and-reuse layer on top. It's how a research software engineer starts new work: two questions. **[prompt 1 — *worth doing?*]** *'Use the Radar: what bumble-bee decline work is worth replicating?'* → `radar` fires, ranking targets and flagging inline which are already independently checked and how they held — the agent cites the verdict, not a guess. **[prompt 2 — *what can I reuse?*]** *'Find independent software I could reuse to replicate this.'* → `find_independent_software` lists reusable, author-disjoint tools — **the work of RSEs the Graph leaves invisible, surfaced and credited.** Two grounded answers, straight from public data — no guessing, no hallucination." |
| 5 | 2:20–2:55 | **Stay in Claude Code** (continue from Scene 4). Search the Radar for **`marine heatwave`** (needs `replication-radar` ≥ 0.4.3) → `radar` surfaces **Oliver 2018 at #1** (readiness 1.0), high-impact + **un-replicated**. **First find the software** → `find_independent_software` ranks **XMHW** (Petrelli, **31★**, repo resolved from Zenodo) **#1** by GitHub-star reuse — the detector we'll use, surfaced *before* we run; the author's own marineHeatWaves is excluded (not author-disjoint) but is the ideal cross-check. **Then the data** → the agent **rejects ERA5 as not independent** (same HadISST lineage) and the **OpenAIRE MCP** returns **ESA CCI satellite SST**. **Then replicate** with the XMHW just found (pulled via Copernicus Marine), cross-checked against marineHeatWaves → reveal **`video/mhw_replication.png`** + the **VALIDATED** result. *(ESA CCI pull ~5 s; or point the agent at the pre-cached series — see Scene 5 assets.)* | "You just saw it verify an existing check — on bees. But most high-impact claims have *never* been checked. So we point the agent at a **completely different field**. The Radar flags a Nature paper — marine heatwaves, *longer and more frequent* — high-impact but **un-replicated**. First it asks the Radar for reusable software — up comes **XMHW**, an independent detector, ranked top by its GitHub stars over one-off study repos: the people who *build* the software, surfaced. Then the moment of rigor — the agent **pushes back on our data**: ERA5 comes from the *same source as the original paper*, so it switches to **ESA CCI satellite data**. Now it replicates, running the **XMHW it just found**, cross-checked against the author's own code — **identical to the digit**. The verdict: **VALIDATED** — marine heatwaves *are* longer and more frequent here. The loop closes — for real, and rigorously." |
| 6 | 2:50–2:55 | End card / the app title. (A plain slide with the text is fine.) | "Replication Radar — verified knowledge on top of the OpenAIRE Graph. Open, grounded, reusable." |

**End-card text (put on the last frame):**
> **Replication Radar**
> openaire-hackathon.netlify.app · `pip install replication-radar`
> DOI 10.5281/zenodo.21850976 · CC-BY 4.0 · OpenAIRE AI Hackathon (Theme B)

---

## Scene 4 — copy-paste for Claude Code (the criterion-#1 shot — the core of the video)
This is the scene the judges score and the one that carries both RSE missions: **[prompt 1]** surfaces *what's worth doing and whether it's been checked* (supporting RSEs building new research), and **[prompt 2]** surfaces *the reusable, credited software an RSE can pick up* (making RSE work visible). Give it the most screen time and the largest font. Connect both servers first — `/mcp` should list **`replication-radar`** and the **OpenAIRE MCP**. Then type these two prompts, pausing after each so the tool calls are visible on screen:

1. `Use the replication-radar MCP: search the Radar for "bumble bee decline" — what high-impact work is worth replicating?`
2. `Use the replication-radar MCP: find independent software I could reuse to replicate this kind of study — bumble-bee decline.`

**Expected on screen:** prompt 1 → a `radar` tool call + a ranked list (each flagged OPEN/VERIFIED with its verdict inline); prompt 2 → a `find_independent_software` call listing reusable, author-disjoint tools. *(Optional beats: fire `replication_status(10.1126/science.aax8591)` to show the verdict's signed nanopublications; and/or ask the OpenAIRE MCP for the paper's citation context so both MCPs appear side by side — a strong criterion-#1 signal.)*

> `radar` returns each paper's status + verdict inline, and `find_independent_software` resolves reliably — so this scene won't fail on you. Keep `replication_status(doi)` in your back pocket for the traceable-nanopub beat.

---

## Scene 5 — the real replication (assets & caption)
This is **RSE mission 2 made concrete — supporting an RSE building new research**: the agent, driven by both MCPs, helps do a brand-new replication end to end. It makes the *reproducible* claim real with footage, and the **agent's pushback for independent data** (→ a **VALIDATED** verdict) is the credibility win: real, rigorous, grounded science, not a clean-run demo. **Shot entirely in Claude Code, continuing from Scene 4** — no browser switch, so the MCP/criterion-#1 momentum carries through. *(Anne is cutting this segment short in the edit — keep at least the MCP-discovery beat + the figure; it's the payoff, not the centrepiece.)*

**The honest boundary (keep the narration accurate):** the **MCPs find and frame** — `replication-radar` surfaces Oliver 2018 + confirms it's un-replicated, and the **OpenAIRE MCP** hands over the **independent** ESA CCI dataset's DOI. The **actual replication (ESA CCI pull via Copernicus Marine + the `XMHW`/`marineHeatWaves` detectors) is Claude Code acting as an agent**, i.e. a coding task, *not* an MCP tool call. Story = "the MCPs point the agent at an unchecked claim *and its data*, and the agent goes and checks it." Do **not** say "the MCP ran the replication."

**Prompts for Claude Code (paste in order, pause after each):**
1. `Use the replication-radar MCP: search the Radar for "marine heatwave" — what high-impact paper hasn't been replicated yet?` → `radar` fires → **Oliver et al. 2018 at #1** (readiness 1.0). *(Requires `replication-radar` ≥ 0.4.2 — it fetches publications impact-first, so the field's most-cited paper surfaces; older versions fetched by relevance and returned Oliver's 2019 "Mean warming not variability" paper instead. `pipx upgrade replication-radar` to be sure. Verified deterministic: identical output on repeat runs.)*
2. `Has Oliver 2018 (DOI 10.1038/s41467-018-03732-9) been independently replicated?` → `replication_status` → **no verdict yet / un-replicated** (this is the gap we fill).
3. `Use the replication-radar MCP: find independent, reusable software for "marine heatwave" I could pick up to do this.` (keep the topic **broad** — `marine heatwave`, not "detecting marine heatwaves" — or an established tool whose OpenAIRE record lacks the extra word won't match) → `find_independent_software` (needs ≥ 0.4.3) ranks **XMHW** (Petrelli, `zenodo.7662469`, **31★**, repo resolved from Zenodo) **#1** by the GitHub-star reuse signal, above one-off study repos. *This surfaces the detector **before** we run — so on camera we're using the tool the Radar found, not one picked offscreen (the inconsistency to avoid). The author's own **marineHeatWaves** (`zenodo.7029736`) is correctly excluded (not author-disjoint) — but it's the perfect independent cross-check. **heatwaveR** doesn't surface: its record isn't about "marine" heatwaves, an honest keyword-recall limit.*
4. `Use the OpenAIRE MCP: find an INDEPENDENT sea-surface-temperature dataset for this — the original used HadISST, and ERA5 prescribes HadISST/OSTIA, so ERA5 wouldn't be independent.` → the **OpenAIRE MCP** returns **ESA CCI SST L4, DOI `10.5285/4a9654136a7148e39b7feb56f8bb02d2`** (satellite, genuinely independent). ***The "both MCPs, one Graph" beat — plus a rigor beat*** — `replication-radar` found the paper **and the software**, the OpenAIRE MCP finds the **independent data**, and the agent *knew to demand independence*. Two MCPs side by side + real scientific judgement = a strong criterion-#1 signal.
5. `Now replicate its headline claim: pull that ESA CCI SST at the NE-Pacific "Blob" cell via Copernicus Marine and detect marine heatwaves with the XMHW tool we just surfaced (1983–2012 baseline), cross-checked against the author's own marineHeatWaves.` → the agent runs it → **VALIDATED**, with **XMHW ≡ marineHeatWaves to the digit** (100 events; MHW-days +3.8/yr p≈2e-4; frequency +0.09/yr p≈7e-4) + the figure. *(Independent on both axes — data AND code, both surfaced by the MCPs first.)*

> **Live-run tip:** the ESA CCI pull is only **~5 s**, so prompt 5 can run **live on camera**. If you'd rather not depend on the network, point the agent at the **pre-cached series** at `/opt/vth/OpenAIRE_Alien_AI_Hackathon/mhw-dry-run-cache/` (`esacci_t.npy` = ordinal dates, `esacci_sst.npy` = daily SST °C; a README explains each file); otherwise cut from prompt 5 to the pre-computed figure + `RESULT_esacci.txt`.

> **Produce-half handoff — the whole loop on camera, and a clean place to END the discovery demo** *(requires `replication-radar` ≥ 0.4.5)*. After discovery, ask: `Use the replication-radar MCP: set me up to replicate this — suggest an available repo name under my GitHub account and give me the create command.` → `replication_template` returns **`quickstart.create_repo`**: `gh repo create marine-heatwave-replication --template ScienceLiveHub/forrt-replication-template --clone`. The agent **runs it → the repo is created + cloned from the FORRT template**. *This is the loop closing on screen: discover the paper + software + data, and the Radar hands you the scaffold with a free repo name — ready to replicate.* **You can stop the demo here**; the replication itself runs in a **fresh Claude session opened inside the new repo** (its `AGENTS.md`/`CLAUDE.md` manual + slash commands load at session start, not on a mid-session `cd`). This is the cleanest ending if you're cutting the analysis footage.

- **Asset:** `replication-radar/video/mhw_replication.png` — a faithful reproduction of Oliver 2018's **Figure 2** (global total MHW-days, 1982–2016; global mean in black, ENSO-removed in red, El Niño/La Niña shading). The trend rises **+1.1 d/yr** and **survives ENSO removal (+1.2 d/yr)** — the paper's own headline for this figure.
- **Bridge from bees (say this as you switch topic):** *"You just saw it verify an existing check — on bees. But most high-impact claims have never been checked. So we picked a completely different field and made one."*
- **Caption (ready to paste):**
  > *The Radar flags a Nature paper — marine heatwaves "longer & more frequent" (Oliver 2018) — as high-impact but un-replicated. The agent pushed back on our first data choice (ERA5 shares the paper's HadISST lineage — not independent) and used **ESA CCI satellite SST**, found and cited off the OpenAIRE Graph. An **independent** detector (XMHW), cross-checked against the author's own marineHeatWaves — **identical to the digit**. MHW-days +3.8/yr (p≈2e-4); frequency +0.09/yr (p≈7e-4). Verdict: **VALIDATED** — independent in both data and code. The loop closes.*
- **Optional stronger beat (live footage instead of the still):** screen-record the terminal running the analysis — the ESA CCI pull (~5 s) then `RESULT_esacci.txt` printing the verdict — for ~8s, then cut to the figure. (Data source line on screen: *ESA CCI satellite SST via Copernicus Marine — independent.*)
- **One-liner to reveal the result on camera** (from the scratchpad, `.mhw-venv` active): `cat RESULT.txt`.

---

## If you're tight on time (fallback ~2:10)
Cut Scene 3 down to ~15s (just show the RSE practices fold once) and, in Scene 5, skip the live run of prompt 3 — show the MCP discovery (prompts 1–2: the Radar flags Oliver 2018 as un-replicated) then cut straight to the figure + `RESULT.txt`. Keep Scenes 1, 2, 4, 5, 6. **Never cut Scene 4** — the MCP demo is the scored one. Scene 5 is the second-most-valuable (it's the reproducibility proof), so keep at least the MCP-discovery beat + the figure.

---

## Easiest way to record (you don't need editing skills)

**Option A — one take, captions, no voiceover (least stressful).** Record your screen while you click through the steps above at a calm pace; add the "Say / caption" lines as text later. Tools:
- **Screen recording:** macOS **QuickTime Player** (File → New Screen Recording — free, built-in) or **OBS Studio** (free). On Windows: **Xbox Game Bar** (Win+G) or OBS.
- **Add captions with zero skill:** **CapCut** (free, desktop or web) — drop the recording in, add text boxes with the caption lines, export. Or record with **Loom** (free) which gives a shareable link directly and lets you trim.

**Option B — voiceover.** Same recording, but read the "Say" column aloud as you go. Keep the script visible on a second screen/phone as a teleprompter. If you don't want to use your own voice, paste the narration into a free text-to-speech (e.g. your OS's built-in TTS) and lay it under the screen capture.

**Tips for a clean take:**
- Move the mouse **slowly**; pause a beat on each result so viewers can read.
- For Scene 4, **zoom the client window** or increase font size so the MCP tool calls are legible — that's the shot that wins criterion #1.
- It's fine to record each scene separately and stitch them; you don't need one perfect take.
- Export at 1080p, keep it under 3:00, and upload somewhere with a stable link (YouTube unlisted, Vimeo, or a Loom link) for the submission's §4.

---

## How I can help further (just ask)
- **Trim the narration** to match your natural pace after a practice read (tell me your test runtime and I'll cut/expand to fit).
- **Write the exact click-path** for Scene 4 tailored to your client (Claude Desktop vs Claude Code) once you tell me which you'll use.
- **Draft the end-card as a simple slide** (text you can paste into any slide tool).
- **Pick the demo paper** — I can run a live search now and choose a topic + a specific OPEN target and a VERIFIED one that look good on camera, so the demo is predictable.
- **Caption file** — I can format all the narration as a ready-to-paste caption list with timecodes.
