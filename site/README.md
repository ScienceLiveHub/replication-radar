# Replication Radar — web app

A **live, client-side** Replication Radar: type a research field and it queries the
OpenAIRE Graph API directly from the browser (CORS-enabled), ranks replication
targets by readiness, finds independent reusable tooling, and overlays whether each
claim has already been checked by a Science Live replication. **No backend** — pure
static files calling OpenAIRE + a bundled `verdicts.json`.

Same engine as the `replication-radar` Python package / MCP server; this is the
browser port so the verdicts and logic agree.

## Run locally

```bash
cd site
python3 -m http.server 8000
# open http://localhost:8000
```

(Open via a local server, not `file://` — the browser blocks `fetch` of
`verdicts.json` over `file://`.)

## Deploy to Netlify

Static, no build step (`netlify.toml` at the repo root sets `publish = "site"`).

- **Git-connected (recommended):** Netlify → *Add new site* → *Import from Git* →
  pick `ScienceLiveHub/replication-radar`. Build command: *(none)*. Publish
  directory: `site`. Auto-redeploys on every push.
- **Drag-and-drop:** drop the `site/` folder onto the Netlify dashboard.

## Refresh the verdict overlay

`site/verdicts.json` is a copy of the package's index. To update it after publishing
new Science Live chains:

```bash
python scripts/build_verdicts.py /path/to/chains -o src/replication_radar/data/verdicts.json
cp src/replication_radar/data/verdicts.json site/verdicts.json
```
