# Getting the two MCPs into Claude Code (available in every session)

A quickstart for connecting the two MCP servers the Replication Radar demo uses, **user-scoped** so they show up in *any* Claude Code session (any folder):

1. **`replication-radar`** — our own MCP (the FORRT verdict tools: `radar`, `replication_status`, `find_independent_software`, `verified_claims`). *There is no separate "FORRT MCP" — this is it.* A pip install, no login.
2. **`openaire`** — the hackathon's OpenAIRE MCP behind the Alien gateway. Adds citation/relationship tools. One-time browser login (OAuth).

> For the video you **must** have `replication-radar`; `openaire` is the optional "two MCPs side by side" bonus. Do #1 first.

## Scopes — the key idea

`claude mcp add` defaults to **`local`** scope = only the current project. To have a server in **every** session, add it with **`--scope user`** (`-s user`). Everything below uses `-s user`.

Because a user-scoped server runs the **same command from every folder**, that command must be an **absolute path that always exists** — a project's `./.venv` won't exist in other projects. So either install it globally (pipx) or reference an absolute venv path that you won't delete.

---

## 1 · `replication-radar` (required, ~2 min)

### Option A — global install (recommended: robust, no path juggling)

```bash
pipx install replication-radar                 # puts `replication-radar` on your PATH
claude mcp add -s user replication-radar -- replication-radar
```

*(No pipx? `python3 -m pip install --user pipx && python3 -m pipx ensurepath`, then reopen the shell.)*

### Option B — use the `.venv` you already installed into

Reference the **absolute** path to the venv's executable (works from anywhere, as long as you keep that venv):

```bash
realpath .venv/bin/replication-radar           # -> /home/you/proj/.venv/bin/replication-radar
claude mcp add -s user replication-radar -- /home/you/proj/.venv/bin/replication-radar
```

> A dedicated venv you won't delete is safest, e.g. `python3 -m venv ~/.venvs/radar && ~/.venvs/radar/bin/pip install replication-radar`, then add `~/.venvs/radar/bin/replication-radar`.

**Smoke-test the package works** (prints `True`):

```bash
replication-radar --help >/dev/null 2>&1 || true   # (server command; no output is fine)
python3 -c "from replication_radar.radar import replication_status; print(replication_status('10.1126/science.aax8591')['replicated'])"
```

*(For Option B, run the `python3 -c ...` line with that venv's python: `.venv/bin/python -c "..."`.)*

### Optional — a GitHub token (better reusable-software ranking)

`find_independent_software` ranks tools partly by **GitHub stars**, fetched live from the GitHub API. Unauthenticated is capped at **60 requests/hour**, so after a few queries the star numbers stop resolving (the ranking still works — it falls back to the other reuse signals — just without the counts). A token lifts the limit to **5,000/hour**. Attach it to the server so it's set on every launch:

```bash
claude mcp remove replication-radar
claude mcp add -s user -e GITHUB_TOKEN=ghp_YOURTOKEN replication-radar -- replication-radar
```

Use a **classic PAT with no scopes ticked** (or a fine-grained token with public read only): star counts are public data, so it needs **no permissions** — it only raises the rate limit. It is stored in `~/.claude.json`, so a no-scope token keeps that safe. (The server also accepts `RADAR_GITHUB_TOKEN`.)

---

## 2 · `openaire` (optional, ~3 min — includes a browser login)

```bash
claude mcp add -s user --transport http openaire https://openaire.mcp.alien.club/mcp
```

Then trigger the login: start `claude`, run `/mcp`, pick **openaire → Authenticate**. A browser opens; log in and approve. The token is stored for your user, so it carries across sessions (log in once).

> **Two gotchas that tripped us before:**
> - After you approve, the browser redirects to a `localhost` address and may show **"connection refused" / "can't reach this page". That is the SUCCESS screen** — the login worked. Don't close it in a panic.
> - If Claude Code asks you to **paste the callback URL**, copy the *entire* `http://localhost:PORT/callback?code=...` from the browser address bar and paste it back. Keep the tab open until it says connected.

---

## 3 · Verify (from *any* folder)

```bash
claude mcp list        # both should appear as ✔ Connected
```

Then open `claude` in a **totally different directory** and run `/mcp` — both should still be listed:

```
replication-radar  ✔ Connected
openaire           ✔ Connected
```

That "different directory" check is what proves the **user** scope worked. It's also the state the video's Scene 4 expects (`/mcp` on screen showing both).

**Check the scope explicitly** — this is the reliable test (both must say *User*):

```bash
claude mcp get replication-radar | grep -i scope
claude mcp get openaire | grep -i scope
```

Each should print `Scope: User config (available in all your projects)`. If either says **`Local config (private to you in this project)`**, it works *only* in that one folder — fix it under Troubleshooting below. (This bites easily: a server you added earlier at local scope stays local — a later `-s user` add does **not** replace it.)

---

## Troubleshooting

- **Only works in one folder / `claude mcp get` says `Local config`?** That server is local-scoped and won't appear elsewhere. **A `-s user` add does NOT replace an existing local registration** — remove the local one first, then add it user-scoped:
  ```bash
  # stdio (replication-radar):
  claude mcp remove replication-radar
  claude mcp add -s user replication-radar -- <path-or-command from §1>

  # http (openaire) — re-adding drops the login, so you must RE-AUTHENTICATE:
  claude mcp remove openaire
  claude mcp add -s user --transport http openaire https://openaire.mcp.alien.club/mcp
  # then: start `claude` -> /mcp -> openaire -> Authenticate (browser login again)
  ```
- **`replication-radar` shows `Failed to connect — -32000: Connection closed`** → the PyPI 0.4.0 release pulls an incompatible `mcp` 2.x (which dropped `mcp.server.fastmcp`), so the server crashes on startup. Install the 1.x SDK into the **same environment** the command runs from:
  ```bash
  "$(dirname "$(which replication-radar)")/pip" install 'mcp>=1.2,<2'   # venv
  # pipx: pipx runpip replication-radar install 'mcp>=1.2,<2'
  ```
  then restart `claude`. (Fixed for good in 0.4.1 — no pin needed once that's on PyPI.)
- **`replication-radar` not connecting (other)** → confirm the command/path resolves from any folder (`which replication-radar`, or that the absolute venv path exists). Re-run the smoke-test in §1.
- **`openaire` auth loops or fails** → `claude mcp remove openaire` then re-add and re-authenticate. Login is per-machine; you'll redo it on a new laptop.
- **See / manage what's registered** → `claude mcp list`, `claude mcp get <name>`, `claude mcp remove <name>`.

*(These commands are for Claude Code. For Claude Desktop, the equivalent is a JSON block in its config file — ask if you want the Desktop version written out.)*
