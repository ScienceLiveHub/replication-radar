"""Build data/verdicts.json by mining Science Live FORRT chains — format-agnostic.

For each repo under a root, gather every published nanopub trusty-URI from any
markdown file (PUBLISHED.md, README.md, index.md, docs/…), then classify each
nanopub from its *TriG body* (not the surrounding markdown) and extract:
  - the cited literature DOI (the original paper a Quote/CiTO points at),
  - the Outcome verdict,
  - the CiTO relation(s).

This catches chains that don't use the canonical PUBLISHED.md table (FIESTA,
spherical-ml, bio-oracle, …) and ignores noise DOIs (Zenodo deposits, the FAIR4RS
principles paper, arXiv) that appear in READMEs but aren't the replication anchor.

    python scripts/build_verdicts.py /path/to/chains-root \
        -o src/replication_radar/data/verdicts.json

Stdlib only. TriG bodies are cached under /tmp so re-runs are fast.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
import sys
import urllib.request

TRUSTY = re.compile(r"(RA[A-Za-z0-9_-]{40,})")
DOI = re.compile(r"(?:doi\.org/|doi:)(10\.[0-9]{4,}/[A-Za-z0-9._:/()-]+)", re.I)
VERDICT = re.compile(r"\b(Validated|Partially[\s-]?Supported|Not[\s-]?Supported|Refuted|Mixed|Inconclusive)\b", re.I)
CITO = re.compile(r"(?:spar/)?cito/([a-zA-Z]+)")
_CANON = {"validated": "Validated", "partiallysupported": "PartiallySupported",
          "notsupported": "NotSupported", "refuted": "Refuted", "mixed": "Mixed", "inconclusive": "Inconclusive"}
# DOIs that appear in chains but are never the replication anchor:
NOISE = ("10.5281/", "10.48550/", "10.15497/rda00068", "10.6084/")  # Zenodo, arXiv, FAIR4RS, figshare
EXCLUDE_PATHS = ("/_build/", "/site/public/", "/node_modules/", "/OLD-ScienceLive/", "/.git/")
CACHE = "/tmp/radar_trig_cache"


def fetch_trig(trusty: str) -> str:
    os.makedirs(CACHE, exist_ok=True)
    cpath = os.path.join(CACHE, hashlib.md5(trusty.encode()).hexdigest())
    if os.path.exists(cpath):
        return open(cpath, encoding="utf-8").read()
    url = f"https://w3id.org/np/{trusty}"
    try:
        req = urllib.request.Request(url, headers={"Accept": "application/trig"})
        with urllib.request.urlopen(req, timeout=25) as r:
            body = r.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print(f"    ! fetch failed {trusty[:10]}…: {e}", file=sys.stderr)
        body = ""
    open(cpath, "w", encoding="utf-8").write(body)
    return body


def is_anchor_doi(d: str) -> bool:
    dl = d.lower().rstrip(").")
    return not any(dl.startswith(n) or n in dl for n in NOISE)


def gather_uris(repo_dir: str) -> list[str]:
    """Read ONLY the repo's own chain registry (first of these that has URIs), so
    cross-references to *other* chains in prose/READMEs can't contaminate the anchor."""
    for rel in ("nanopubs/PUBLISHED.md", "PUBLISHED.md", "README.md", "index.md", "docs/forrt_chains_drafts.md"):
        path = os.path.join(repo_dir, rel)
        if not os.path.exists(path):
            continue
        try:
            uris = sorted({m.group(1) for m in TRUSTY.finditer(open(path, encoding="utf-8", errors="replace").read())})
        except Exception:  # noqa: BLE001
            uris = []
        if uris:
            return uris
    return []


def classify(body: str) -> dict:
    """Pull role-relevant facts out of one nanopub's TriG body."""
    low = body.lower()
    dois = [d.rstrip(").") for d in DOI.findall(body) if is_anchor_doi(d)]
    vm = VERDICT.search(body)
    cito = sorted({c for c in CITO.findall(body) if c.lower() != "cito"})
    return {
        "is_quote": "hasquotedtext" in low or "/quotation" in low,
        "is_cito": bool(cito) and ("citation" in low or "/cito/" in low),
        "is_outcome": bool(vm) and "outcome" in low,
        "dois": dois,
        # the replication's OWN deposit (Zenodo) — it's an OpenAIRE node we link to
        "zenodo": [d.rstrip(").").lower() for d in DOI.findall(body) if d.lower().startswith("10.5281/")],
        "verdict": _CANON.get(re.sub(r"[\s-]+", "", vm.group(1)).lower(), vm.group(1)) if vm else None,
        "cito": cito,
    }


def build(root: str) -> dict:
    index: dict[str, list[dict]] = {}
    no_doi: list[dict] = []
    repos = sorted(d for d in os.listdir(root)
                   if os.path.isdir(os.path.join(root, d)) and not d.startswith(".") and d != "OLD-ScienceLive")
    for repo in repos:
        uris = gather_uris(os.path.join(root, repo))
        if not uris:
            continue
        anchor = verdict = outcome_np = cito_np = None
        cito_rels: list[str] = []
        cito_dois: list[str] = []
        quote_dois: list[str] = []
        outcome_zen: list[str] = []
        any_zen: list[str] = []
        for u in uris:
            c = classify(fetch_trig(u))
            any_zen += c["zenodo"]
            if c["is_cito"]:
                cito_np = cito_np or u
                cito_rels = cito_rels or c["cito"]
                cito_dois += c["dois"]
            if c["is_quote"]:
                quote_dois += c["dois"]
            if c["is_outcome"] and not verdict:
                verdict, outcome_np = c["verdict"], u
                outcome_zen += c["zenodo"]
        # anchor DOI = what the citation points at (preferred) else the quoted paper
        for d in cito_dois + quote_dois:
            anchor = d.lower()
            break
        # the replication's own OpenAIRE node: prefer the DOI the Outcome records
        repo_doi = (outcome_zen + any_zen or [None])[0]
        if not (anchor or verdict or cito_rels):
            continue  # not a recognisable FORRT chain
        print(f"  {repo}: {len(uris)} nps -> doi={anchor or '—'} verdict={verdict or '—'} cito={cito_rels}")
        entry = {
            "repo": repo, "verdict": verdict or "Published", "cito": cito_rels,
            "repo_doi": repo_doi,  # the replication's own OpenAIRE (Zenodo) node
            "outcome_np": f"https://w3id.org/sciencelive/np/{outcome_np}" if outcome_np else None,
            "cito_np": f"https://w3id.org/sciencelive/np/{cito_np}" if cito_np else None,
        }
        if anchor:
            index.setdefault(anchor, []).append(entry)
        else:
            no_doi.append({**entry, "note": "Mode-B / paperless or no literature anchor in chain"})

    return {
        "_meta": {
            "source": "Science Live FORRT replication chains — mined by scripts/build_verdicts.py (format-agnostic, from nanopub TriG bodies)",
            "schema": "doi (lowercased) -> list of verifications {repo, verdict, cito[], outcome_np, cito_np}",
            "note": "The 'already-checked' overlay of the Replication Radar. Verdicts live in CiTO/Outcome nanopubs; the OpenAIRE Graph cannot hold them.",
        },
        "verifications": index,
        "no_doi": no_doi,
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("root")
    ap.add_argument("-o", "--out", default="src/replication_radar/data/verdicts.json")
    args = ap.parse_args()
    print(f"mining chains under {args.root} …")
    data = build(args.root)
    json.dump(data, open(args.out, "w", encoding="utf-8"), indent=2, ensure_ascii=False)
    n = sum(len(v) for v in data["verifications"].values())
    print(f"\n-> {len(data['verifications'])} DOIs, {n} verifications, {len(data['no_doi'])} no-DOI chains -> {args.out}")
