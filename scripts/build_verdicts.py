"""Build data/verdicts.json by mining Science Live FORRT chains.

Walks a root directory for `nanopubs/PUBLISHED.md` registry files, parses each
chain's step URIs, and fetches the nanopub TriG bodies to extract:
  - the cited literature DOI (from the Quote / step 01),
  - the Outcome verdict (step 05),
  - the CiTO relation(s) (step 06).

This makes the "already-checked" overlay a *reproducible* artifact rather than a
hand-curated list. Re-run it whenever new chains are published:

    python scripts/build_verdicts.py /path/to/chains-root \
        -o src/replication_radar/data/verdicts.json

Stdlib only. Network: ~3 fetches per chain; failures are tolerated and logged.
"""
from __future__ import annotations

import argparse
import json
import os
import re
import sys
import urllib.request

TRUSTY = re.compile(r"(RA[A-Za-z0-9_-]{40,})")
DOI = re.compile(r"(?:doi\.org/|doi:)(10\.[0-9]{4,}/[A-Za-z0-9._:/()-]+)", re.I)
VERDICT = re.compile(
    r"\b(Validated|Partially[\s-]?Supported|Not[\s-]?Supported|Refuted|Mixed|Inconclusive)\b",
    re.I,
)
CITO = re.compile(r"(?:spar/)?cito/([a-zA-Z]+)")
_CANON = {
    "validated": "Validated",
    "partiallysupported": "PartiallySupported",
    "notsupported": "NotSupported",
    "refuted": "Refuted",
    "mixed": "Mixed",
    "inconclusive": "Inconclusive",
}


def fetch_trig(trusty: str) -> str:
    url = f"https://w3id.org/np/{trusty}"
    req = urllib.request.Request(url, headers={"Accept": "application/trig"})
    try:
        with urllib.request.urlopen(req, timeout=25) as r:
            return r.read().decode("utf-8", "replace")
    except Exception as e:  # noqa: BLE001
        print(f"    ! fetch failed {trusty[:12]}…: {e}", file=sys.stderr)
        return ""


def classify(line: str) -> str | None:
    low = line.lower()
    if "outcome" in low:
        return "outcome"
    if "cito" in low:
        return "cito"
    if "quote" in low or "pcc" in low or "pico" in low or "| 01 " in low:
        return "quote"
    return None


def parse_registry(path: str) -> dict:
    roles: dict[str, list[str]] = {"quote": [], "outcome": [], "cito": []}
    with open(path, encoding="utf-8") as fh:
        for line in fh:
            m = TRUSTY.search(line)
            if not m:
                continue
            role = classify(line)
            if role:
                roles[role].append(m.group(1))
    return roles


def first(seq):
    return seq[0] if seq else None


def build(root: str) -> dict:
    index: dict[str, list[dict]] = {}
    no_doi: list[dict] = []
    registries = []
    for dirpath, _dirs, files in os.walk(root):
        if "node_modules" in dirpath or "OLD-ScienceLive" in dirpath:
            continue
        for f in files:
            if f.upper().startswith("PUBLISHED") and f.endswith(".md") and dirpath.endswith("nanopubs"):
                registries.append(os.path.join(dirpath, f))

    for reg in sorted(registries):
        repo = reg.split(os.sep)[-3]
        roles = parse_registry(reg)
        if not roles["quote"] and not roles["outcome"]:
            continue
        print(f"  {repo}: quote={len(roles['quote'])} outcome={len(roles['outcome'])} cito={len(roles['cito'])}")

        doi = None
        if roles["quote"]:
            m = DOI.search(fetch_trig(roles["quote"][0]))
            if m:
                doi = m.group(1).rstrip(").").lower()

        outcome_np = first(roles["outcome"])
        cito_np = first(roles["cito"])
        verdict, cito_rels = None, []
        if outcome_np:
            vm = VERDICT.search(fetch_trig(outcome_np))
            if vm:
                key = re.sub(r"[\s-]+", "", vm.group(1).strip()).lower()  # "Partially Supported" -> "partiallysupported"
                verdict = _CANON.get(key, vm.group(1).strip())
        if cito_np:
            body = fetch_trig(cito_np)
            cito_rels = sorted({c for c in CITO.findall(body) if c.lower() not in ("cito",)})

        entry = {
            "repo": repo,
            "verdict": verdict or "Published",
            "cito": cito_rels,
            "outcome_np": f"https://w3id.org/sciencelive/np/{outcome_np}" if outcome_np else None,
            "cito_np": f"https://w3id.org/sciencelive/np/{cito_np}" if cito_np else None,
        }
        if doi:
            index.setdefault(doi, []).append(entry)
        else:
            no_doi.append({**entry, "note": "Mode-B / paperless or DOI not found in Quote"})

    return {
        "_meta": {
            "source": "Science Live FORRT replication chains (nanopub verdicts), built by scripts/build_verdicts.py",
            "schema": "doi (lowercased) -> list of verifications {repo, verdict, cito[], outcome_np, cito_np}",
            "note": "The 'already-checked' overlay of the Replication Radar. Verdicts are carried in CiTO/Outcome nanopubs; the OpenAIRE Graph cannot hold them.",
        },
        "verifications": index,
        "no_doi": no_doi,
    }


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("root", help="directory to walk for nanopubs/PUBLISHED.md")
    ap.add_argument("-o", "--out", default="src/replication_radar/data/verdicts.json")
    args = ap.parse_args()
    print(f"mining chains under {args.root} …")
    data = build(args.root)
    with open(args.out, "w", encoding="utf-8") as fh:
        json.dump(data, fh, indent=2, ensure_ascii=False)
    n = sum(len(v) for v in data["verifications"].values())
    print(f"\n-> {len(data['verifications'])} DOIs, {n} verifications, {len(data['no_doi'])} no-DOI chains -> {args.out}")
