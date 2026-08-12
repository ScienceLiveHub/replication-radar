# Contributing to Replication Radar

Thanks for your interest in improving Replication Radar! Whether you've found a
bug, want a new signal, or would like to add your bio to the team — you're
welcome here. This project is part of the [Science Live](https://sciencelive4all.org)
ecosystem and is developed in the open.

By participating, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## Ways to contribute

- **Report a bug or suggest a feature** — open a [GitHub issue](https://github.com/ScienceLiveHub/replication-radar/issues).
- **Improve the code or docs** — open a pull request (see below).
- **Join the team** — add your bio via the *"Add your bio"* issue template
  ([`.github/ISSUE_TEMPLATE/join-the-team.md`](.github/ISSUE_TEMPLATE/join-the-team.md)).
- **Run a replication** — the whole point! See the
  [how-to guide](https://openaire-hackathon.netlify.app/replicate.html).

## The project has two parts

**1. The web app (`site/`)** — a pure static site (HTML/CSS/JS), **no build step**.
- Run it locally: `cd site && python3 -m http.server` → open <http://localhost:8000>.
- Or just open `site/index.html` in a browser.
- Deployed by Netlify on every push to `main`.

**2. The MCP server (`src/replication_radar/`)** — Python, on PyPI.
- Dev install: `pip install -e ".[dev]"`
- Run it: `replication-radar`
- Tests: `pytest`

## Development guidelines

These are the principles that keep the tool trustworthy — please follow them
(the full list is in [`CLAUDE.md`](CLAUDE.md)):

- **Grounded sources only.** Every signal must come from a real, named source
  (OpenAIRE Graph / the nanopublication network / GitHub / Software Heritage /
  Zenodo). No relevance-by-keyword-guessing — we removed a feature that did that.
- **Verify before building.** Probe an API live (a `curl` or a small snippet)
  *before* wiring it in.
- **No unverifiable numbers on screen.** Don't display a count the tool can't stand behind.
- **The static site holds no keys.** Any token stays server-side (the Netlify function proxy).
- **Keep `site/app.js` `node --check`-clean.**

## AI-assisted contributions

AI agents and AI-assisted contributions are **welcome** — this project is itself
built with AI assistance, and helping agents contribute *well* is part of what we
explore. Two conditions keep it trustworthy, and they mirror what the tool itself
stands for:

- **A human is accountable.** An AI can draft code, docs, or analysis, but a
  *person* must understand, verify, and stand behind every contribution before
  opening it — and a human reviews it before it is merged. AI does not get
  autonomous merge rights.
- **Grounded, never hallucinated.** Any AI-generated signal, number, citation, or
  claim must trace to a real, named source — the exact rule the Radar enforces on
  screen. No invented references, counts, or "relevance." If it can't be verified,
  it doesn't ship.

Please **note substantial AI assistance in your PR description** (honest
provenance), and respect the licences and attribution of any sources an agent
draws on. In short: **use AI freely, verify like a scientist.**

## Opening a pull request

1. Fork the repo (or branch from `main` if you have write access).
2. Make focused changes on a topic branch.
3. Check your work: `node --check site/app.js`, and `pytest` if you touched the MCP.
4. Open a PR describing **what** changed and **which grounded source(s)** it uses.
   Small, reviewable PRs are easier to merge.

## Questions

Open an issue, or reach the maintainers via the channels above. Conduct concerns:
see the [Code of Conduct](CODE_OF_CONDUCT.md).

## License

Replication Radar's code is released under the **MIT License**; the write-up,
methodology spec and verdict index are **CC-BY 4.0**. By contributing, you agree
your contributions are licensed under the same terms.
