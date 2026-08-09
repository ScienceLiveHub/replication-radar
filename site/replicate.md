The Radar tells you **what** is worth replicating. This page is the **how**: the end-to-end loop that turns a target into an independent, signed, citable replication — and how a research software engineer can run it with an AI agent using the open **replication-radar** MCP together with the FORRT replication template.

## The replication loop

Five steps. Each replication you publish becomes a public, author-attributed nanopublication — and shows back up here as an independently-checked result, so the next person sees it.

1. **Find a target** *(Radar)* — Search a topic and pick a high-**priority** paper that is still **OPEN** (not yet checked). The priority score and the claim tell you what would be worth re-testing.
2. **Scaffold with the FORRT replication template** *(template)* — Start from the [FORRT replication template](https://github.com/ScienceLiveHub/forrt-replication-template). It scaffolds the repository *and* the signed nanopublication chain — **Claim · Study · Outcome** — so your work is structured and verifiable from the start.
3. **Run the replication** *(you)* — Re-test the same claim with **different** data or methods (replication, not just re-running the original code). Record your materials, code and — where relevant — the geographic coverage, following the good-practice checks the Radar looks for.
4. **Publish the signed chain** *(Science Live)* — Publish the nanopublication chain to the [Science Live](https://sciencelive4all.org) network. It is cryptographically signed, attributed to you, and citable — your replication counts as a first-class research output.
5. **It reappears on the Radar** *(Radar)* — Because verdicts are read **live** from the network, your replication now surfaces here as **independently checked**, with its verdict — and its code gets a FAIR-software score plus the RSE good-practice signals.

## Getting started — step by step

The workflow runs on the **`replication-radar` MCP** — connect it to your AI coding agent and it exposes the discovery tools right inside your repo, so you can pick a paper and drive the whole replication without leaving the agent. The FORRT template already ships the MCP in its `.mcp.json`, so it's there the moment you open your cloned repo.

**You'll need:** [Git](https://git-scm.com), [`uv`](https://docs.astral.sh/uv/) (runs the MCP), [`pixi`](https://pixi.sh) (the analysis environment), and any **MCP-capable AI coding agent** — [Claude Code](https://claude.com/claude-code), [OpenAI Codex CLI](https://developers.openai.com/codex/mcp), [Google Gemini CLI](https://github.com/google-gemini/gemini-cli), Cursor, Aider, and others (full list at [modelcontextprotocol.io/clients](https://modelcontextprotocol.io/clients)).

**In practice you mostly just talk to your agent.** Open the repo, describe what you're interested in, answer its questions — it orchestrates discovery, setup, and the replication for you. The numbered steps below are what's happening under the hood. Nothing to install for the MCP: the template already declares it, so your agent runs it automatically (via `uvx`) the first time it's needed.

### 1. Create your repository from the template
On GitHub, open [`ScienceLiveHub/forrt-replication-template`](https://github.com/ScienceLiveHub/forrt-replication-template) → **"Use this template" → Create a new repository**. Or with the GitHub CLI:

```bash
gh repo create my-replication --template ScienceLiveHub/forrt-replication-template --public
```

### 2. Clone it and open it in your agent

```bash
git clone https://github.com/<you>/my-replication.git
cd my-replication
```

Open the repo in your AI coding agent. The template's `.mcp.json` declares the **`replication-radar`** MCP (`uvx replication-radar`), so any MCP-capable agent picks it up — approve the server when asked and confirm the tools are available. You don't install it separately; `uvx` fetches it from PyPI on first use (so `uv` must be on your PATH). *(Adding the MCP to a specific agent — or using it outside the template — is in the per-client table in the next section.)*

> **The OpenAIRE MCP is optional.** The `radar` tool already queries the public OpenAIRE Graph, so you need nothing else to pick a paper. The OpenAIRE MCP (Alien gateway, OAuth) adds richer *citation-graph* exploration — add it if you want that.

### 3. Pick a paper — with the MCP tools
Ask your agent, in plain language, to use the **`replication-radar`** MCP. Three tools do the work:

| Ask your agent… | It calls | You get |
|---|---|---|
| "What bumble-bee decline work is worth replicating?" | `radar("bumble bee decline")` | impact-ranked **OPEN** targets (+ any already **VERIFIED**) |
| "Has this paper been replicated, and did it hold?" | `replication_status(doi)` | the verdict(s), or `open` |
| "Is there independent software I could reuse?" | `find_independent_software(doi)` | reusable tooling **not by the original team** |

Pick a target that's high-impact, not already done, and has independent tooling — that's what makes it a *replication*, not a from-scratch reproduction. *(Claude Code offers a `/radar` shortcut that runs this for you, but the tools are identical in any agent.)*

### 4. Bootstrap the repo for that paper
Now that you've chosen a paper, set the repo up **for that paper** — this is why discovery comes first. Drop the paper's PDF into `paper/`, then ask your agent to substitute the template's placeholder tokens with your identity (name, ORCID) and the paper's DOI, following the template's `AGENTS.md` operating manual. *(Claude Code: `/init-template`; other agents: see [`docs/ai-portability.md`](https://github.com/ScienceLiveHub/forrt-replication-template/blob/main/docs/ai-portability.md).)* One-time after this: enable GitHub Pages at *Settings → Pages → Source: GitHub Actions*.

### 5. Run the replication (agent-guided)
Your agent now follows the template's operating manual (`AGENTS.md` / `CLAUDE.md`) through its phases — read the paper's headline claim, port the code with `pixi`, reproduce the result, cut a **Zenodo-archived release** (a citable DOI), and publish the signed **FORRT nanopublication chain** on Science Live. *(Claude Code adds `/replication-study` to orchestrate and `/verify-chain` to check the chain; any agent can do the same steps from the manual.)*

### 6. It reappears on the Radar
Because the Radar reads verdicts live from the nanopublication network, your finished replication now shows up here as **independently checked** — closing the loop for the next person.

## Do it with an AI agent — the MCP

The same engine behind this site is an **MCP server**, so an AI agent can discover targets and check verdicts for you — the first half of the loop, hands-free. It works with any MCP-capable client (Claude Code, Claude Desktop, OpenAI Codex CLI, Google Gemini CLI, Cursor, VS Code …).

**No login and no API key for the server** — it queries only public sources. You just need to be signed in to *your own* AI client (your Claude / Cursor / … account); adding the server gives that client the four tools below.

**1 · Install it** — any one of:

```bash
pip install replication-radar        # into your Python environment
pipx run replication-radar           # isolated, no install (needs pipx)
uvx replication-radar                # isolated, no install (needs uv)
```

This puts a `replication-radar` command on your PATH. If you installed into a virtual environment, use its **full path** in the config below (e.g. `/path/to/venv/bin/replication-radar`) so the client can always find it — or use `pipx run replication-radar` / `uvx replication-radar` as the command.

**2 · Add it to your client.** Most clients share the same snippet — an `mcpServers` entry:

```json
{
  "mcpServers": {
    "replication-radar": { "command": "replication-radar" }
  }
}
```

Where it goes, per client:

| Client | Where to add it |
|---|---|
| **Claude Code** (CLI) | Run `claude mcp add replication-radar -- replication-radar`, or put the snippet in `.mcp.json` at your project root. Confirm with `/mcp`. |
| **Claude Desktop** | Settings → Developer → **Edit Config** opens `claude_desktop_config.json` — macOS `~/Library/Application Support/Claude/`, Windows `%APPDATA%\Claude\`, Linux `~/.config/Claude/`. Paste the snippet, then restart the app. |
| **Cursor** | Settings → **MCP** → Add, or create `.cursor/mcp.json` (this project) or `~/.cursor/mcp.json` (all projects). [Cursor MCP docs](https://docs.cursor.com/context/model-context-protocol). |
| **VS Code** | Add a `.vscode/mcp.json` — note its top-level key is `servers`, not `mcpServers`. [VS Code MCP docs](https://code.visualstudio.com/docs/copilot/chat/mcp-servers). |
| **OpenAI Codex CLI** | Add the server to Codex's MCP config (`~/.codex/config.toml`, a `[mcp_servers.replication-radar]` table — TOML, not the JSON above). [Codex MCP docs](https://developers.openai.com/codex/mcp). |
| **Google Gemini CLI** | Add an `mcpServers` entry to `~/.gemini/settings.json` (or `.gemini/settings.json` in your project). [Gemini CLI docs](https://github.com/google-gemini/gemini-cli). |
| Any other client | See the official list at [modelcontextprotocol.io/clients](https://modelcontextprotocol.io/clients). |

**3 · Restart the client** and confirm the four tools appear in its tool list.

The four tools, all grounded in the OpenAIRE Graph and the nanopublication network:

| Tool | What it does |
|---|---|
| `radar(topic)` | Impact-ranked replication targets for a research topic — the ranked queue you see here. |
| `replication_status(doi)` | Whether a specific paper has been independently replicated, and with what verdict. |
| `find_independent_software(topic / doi)` | Independent software implementations related to a paper or topic. |
| `verified_claims()` | The set of claims that have been independently checked on the network. |

Example prompts once it's connected:

- *"What high-impact work on species distribution models is worth replicating and hasn't been checked yet?"*
- *"Has `<doi>` been independently replicated? What was the verdict?"*
- *"Find independent software implementations I could reuse for this replication."*

The agent handles discovery and status; the actual replication and signing stay with you and the FORRT template — which is itself agent-ready (it ships an `.mcp.json` and agent instructions), so you can drive the second half of the loop with an agent too.

## Worked example — replicate a species-distribution-model claim

A concrete pass through the loop, with an agent driving the discovery half via the MCP. Species distribution models (SDMs) make a good case: widely used, and the reproduction-vs-replication distinction is sharp.

1. **Ask the agent what's worth replicating** *(MCP)* — *"What high-impact species-distribution-model work is worth replicating and hasn't been checked yet?"* → the agent calls `radar("species distribution model")` and returns impact-ranked **OPEN** targets.
2. **Check a target's status** *(MCP)* — *"Has `<doi>` been independently replicated?"* → `replication_status(doi)` reads the nanopublication network live and answers **open**, or returns the verdict(s) if it has already been checked.
3. **Find an independent implementation** *(MCP)* — *"Find independent software I could reuse."* → `find_independent_software(doi)` returns engines **not authored by the original team** — the line between a reproduction and a replication. (For the classic Phillips et al. 2009 SDM paper, the authors' own `dismo` is flagged non-independent, while `biomod2` / `jSDM` are independent.)
4. **Run the replication with the template** *(template)* — Scaffold from the [FORRT replication template](https://github.com/ScienceLiveHub/forrt-replication-template) and re-test the claim with the independent tool and different data.
5. **Publish, and watch it reappear** *(Radar)* — Publish the signed nanopublication chain. Because the Radar reads verdicts live, your replication now shows up here as independently checked — with its verdict and a FAIR + RSE-practice assessment of your code.

The agent runs the discovery half (steps 1–3) through the MCP; the replication and signing (steps 4–5) stay with you and the template. Pair the `replication-radar` MCP with the OpenAIRE MCP and the agent has both the structural graph and the "has this been checked" layer.

## For research software engineers

Replication is software work. For every replication with a repository, the Radar assesses — live from GitHub, Software Heritage and Zenodo — both the recognised **FAIR-software** recommendations and a set of **RSE good-practice** signals:

FAIR software (public repository · open licence · in a registry · citable · quality artefacts), and — separately — **documented · tests · CI · contributing · code of conduct**, with the repository's own CI status as a grounded reproducibility signal. Each check links to the actual artefact, and every check is explained with links to go deeper (The Turing Way, goodpractice, NumFOCUS, Imperial's Essential Software Engineering course) on the [methodology page](methodology.html#practices).

These are signals, not grades — presence read from the repository, never guessed. The aim is to make the software behind a replication as visible and reusable as the result itself.

---

**[Start from the FORRT template →](https://github.com/ScienceLiveHub/forrt-replication-template)** &nbsp;·&nbsp; [Find a target on the Radar](index.html) &nbsp;·&nbsp; [replication-radar on PyPI](https://pypi.org/project/replication-radar/)
