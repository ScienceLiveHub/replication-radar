# Replication Radar — MCP demo runbook

A clean ~60-second screen recording showing the **verified-knowledge MCP** in an AI agent:
the agent gives a *cited, verified* answer about a research claim instead of a confident,
unchecked one. This is the "cite instead of hallucinate" moment — the AI-hackathon hook.

The MCP is **read-only**: it answers *"has this claim been independently checked, and did it
hold?"* It does **not** start replications (that's the FORRT template). Don't demo a "start a
replication" flow with it.

---

## 1 · One-time setup (~5 minutes)

**Install the MCP in an isolated environment** (so the path is stable for the client):

```bash
python3 -m venv ~/.venvs/radar
~/.venvs/radar/bin/pip install replication-radar      # pulls in the `mcp` runtime too
```

**Smoke-test it works** (should print `True` then a number):

```bash
~/.venvs/radar/bin/python - <<'PY'
from replication_radar.radar import replication_status, verified_claims
print("replicated:", replication_status("10.1126/science.aax8591")["replicated"])
print("verified claims in corpus:", verified_claims()["count"])
PY
```

**Register it with Claude Desktop.** Edit
`~/Library/Application Support/Claude/claude_desktop_config.json` (create it if missing) — use the
**absolute** python path (Claude Desktop does not use your shell PATH):

```json
{
  "mcpServers": {
    "replication-radar": {
      "command": "/Users/annef/.venvs/radar/bin/python",
      "args": ["-m", "replication_radar.server"]
    }
  }
}
```

Quit and reopen Claude Desktop. Click the tools/🔨 icon — you should see **replication-radar**
with 4 tools: `radar`, `replication_status`, `find_independent_software`, `verified_claims`.

**Optional — add the OpenAIRE / Alien Gateway MCP** alongside it (you/Jean have the connection).
It makes the "two MCPs together" point explicit. If wiring it up is fiddly, **skip it** — the
demo lands with just `replication-radar`.

---

## 2 · Pre-flight (right before recording)

1. Ask: *"Which tools do you have from replication-radar?"* → it should list the 4. (Warms it up.)
2. Do **one off-record dry run** of Beat 1 below — it warms the network/HTTP caches so the real
   take is fast and identical.

---

## 3 · The recording — three beats

### Beat 1 — the money shot: verify + cite (≈35 s)

**Type this prompt:**

> I want to cite the finding from Soroye et al. 2020 (Science, DOI 10.1126/science.aax8591) —
> that projected per-species bumble-bee extirpation rankings are robust. Before I do: has that
> claim actually been independently replicated, and did it hold? Give me something citable.

**What to expect:** the agent calls **`replication_status("10.1126/science.aax8591")`** and gets
back `replicated: true` with **5 independent verdicts** — 4 `confirms` (Validated) and 1
`qualifies` (PartiallySupported) — each with a **signed Outcome nanopublication URL** and the
replication's deposit DOI. The answer should say roughly: *"independently replicated 5×, 4
confirmed, 1 qualifies it; here are the signed verdicts to cite,"* with links.

**The point to land (caption or voiceover):** OpenAIRE/citation count would call this paper
"settled"; the MCP shows it's been checked 5 times and hands you **signed, citable verdicts** —
including the one that *qualifies* it. That's the difference between paraphrasing and citing.

### Beat 2 — abstract → atomic claim → verdict: the two-project synergy (≈30 s)

This is the strongest AI beat: the agent turns a paper's **text into a structured claim** and
then **verifies** it, in one turn — your two hackathon projects composing (Jean's Hackaweek
claim-*extraction* pipeline + the Radar's claim-*verification* layer). Needs the MCP **≥ 0.3.3**
(it now returns the paper's abstract).

**Type this prompt:**

> Read the abstract of Soroye et al. 2020 (DOI 10.1126/science.aax8591), extract its single
> central finding as one atomic AIDA sentence, and then tell me whether that exact claim has
> been independently replicated.

**What to expect:** the agent calls **`replication_status("10.1126/science.aax8591")`**, which now
returns the **abstract** alongside the verdicts. The agent reads the abstract, **writes the atomic
claim itself** (something like *"An increasing frequency of unusually hot days raises local
extinction and lowers site occupancy of bumble bees, independent of land-use change"*), and then
reports it has been **independently replicated 5× (4 confirm, 1 qualifies)** with the signed
nanopubs.

**The point to land:** *from a paper's text → a structured, atomic claim → a signed, citable
verdict, in one turn.* Generation meets verification — the full "graph of verified knowledge" arc,
live.

### Beat 3 — the discovery side (≈20 s, optional)

**Type this prompt:**

> What high-impact work on marine heatwaves and species distributions is worth replicating —
> and what's already been checked?

**What to expect:** the agent calls **`radar("marine heatwave species")`** and returns
impact-ranked papers, each flagged **OPEN** (a replication opportunity) or **VERIFIED** (already
checked, with the verdict).

**The point to land:** the same layer also tells an agent *where the replication gaps are*.

---

## 4 · Recording tips

- Resize the Claude window to a clean 1280×800-ish; hide other panels.
- ~45–75 seconds total; no audio needed — burn in 2-3 short captions for the "point to land" lines.
- Keep the tool-call expansion **visible** for a beat (it's proof the answer came from the MCP,
  not the model's memory).
- Export as MP4 or GIF for the submission.

---

## 5 · If the OpenAIRE MCP is set up too

Add a one-line framing before Beat 1: *"Two MCPs are connected — OpenAIRE for the structural
graph, replication-radar for the verification layer."* You don't need to force OpenAIRE to fire;
its presence in the tools list is enough to make the pairing point. The verification answer from
`replication-radar` is the star.

---

*Tools reference — what the agent can call:*

| tool | answers |
|---|---|
| `replication_status(doi)` | Has this DOI been replicated, did it hold? Verdicts + signed nanopub links. |
| `verified_claims()` | The whole verified-knowledge corpus (every claim with a verdict). |
| `radar(topic)` | Impact-ranked replication targets in a field — OPEN vs VERIFIED. |
| `find_independent_software(doi, topic)` | Reusable engines *not* authored by the original team. |
