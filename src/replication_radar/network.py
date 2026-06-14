"""Live, author-agnostic verified-knowledge index from the nanopub network.

Two SPARQL queries on the public nanopub-query service (no auth), over the FORRT
**Outcome** and **CiTO** templates, joined on the nanopub trusty hash — the same
proven logic the web app uses. This is what makes the MCP's replication verdicts
network-wide and current (anyone's signer), not a bundled snapshot.

Endpoint overridable via RADAR_NANOPUB_SPARQL. Stdlib only.
"""
from __future__ import annotations

import csv
import io
import os
import re
import urllib.parse
import urllib.request
from functools import lru_cache

SPARQL = os.environ.get("RADAR_NANOPUB_SPARQL", "https://query.knowledgepixels.com/repo/full")
TPL_OUTCOME = "https://w3id.org/np/RA2zljn0Nw9SadppOyxZoh-_Rxosslrq-vYG-p9SttnJE"
TPL_CITO = "https://w3id.org/np/RA43F9EoOuzF0xoNUnCMNyFsfIqlsuWDdPHCnN0wCdCAw"
VERDICT_RELS = {"confirms", "qualifies", "disputes", "critiques", "extends", "supports", "refutes"}
_CANON = {"validated": "Validated", "partiallysupported": "PartiallySupported", "contradicted": "Contradicted",
          "notsupported": "NotSupported", "mixed": "Mixed", "inconclusive": "Inconclusive"}
_TIMEOUT = float(os.environ.get("RADAR_HTTP_TIMEOUT", "30"))

_QA = f"""PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX slt: <https://w3id.org/sciencelive/o/terms/>
SELECT DISTINCT ?outcome ?status ?repo WHERE {{ GRAPH ?g {{ ?outcome ntpl:wasCreatedFromTemplate <{TPL_OUTCOME}> . }} ?outcome np:hasAssertion ?oa . GRAPH ?oa {{ ?oc slt:hasValidationStatus ?s . OPTIONAL {{ ?oc slt:hasOutcomeRepository ?repo . }} }} BIND(STRAFTER(STR(?s),"/terms/") AS ?status) }}"""

_QB = f"""PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX cito: <http://purl.org/spar/cito/>
SELECT DISTINCT ?cito ?subj ?rel ?orig WHERE {{ GRAPH ?g {{ ?cito ntpl:wasCreatedFromTemplate <{TPL_CITO}> . }} ?cito np:hasAssertion ?ca . GRAPH ?ca {{ ?subj ?rel ?orig . }} FILTER(STRSTARTS(STR(?rel),STR(cito:))) FILTER(CONTAINS(STR(?orig),"doi.org/10.")) }} LIMIT 3000"""


def _sparql(query: str) -> list[dict]:
    url = f"{SPARQL}?{urllib.parse.urlencode({'query': query})}"
    req = urllib.request.Request(url, headers={"Accept": "text/csv"})
    with urllib.request.urlopen(req, timeout=_TIMEOUT) as r:
        rows = list(csv.reader(io.StringIO(r.read().decode("utf-8", "replace"))))
    return [dict(zip(rows[0], row)) for row in rows[1:]] if rows else []


def _hash(uri: str) -> str:
    return re.sub(r".*/np/", "", uri or "")


def _doi(uri: str) -> str:
    return re.sub(r".*doi\.org/", "", uri or "").lower()


def _clean_repo(repo: str) -> str | None:
    if not repo:
        return None
    if "doi.org/" in repo:
        return _doi(repo)
    return repo.lower() if repo.startswith("10.") else repo


@lru_cache(maxsize=1)
def build_index() -> dict:
    """{doi: [ {verdict, cito[], repo_doi, outcome_np, cito_np} ]} — network-wide, author-agnostic.

    Raises on network/parse failure so callers can fall back to the bundled index.
    """
    outcomes = _sparql(_QA)        # sequential: concurrent queries truncate the endpoint
    citos = _sparql(_QB)
    by_hash: dict[str, list] = {}
    for r in citos:
        by_hash.setdefault(_hash(r.get("subj")), []).append({
            "rel": re.sub(r".*cito/", "", r.get("rel", "")),
            "orig": _doi(r.get("orig")),
            "cito": r.get("cito"),
        })
    index: dict[str, list] = {}
    for o in outcomes:
        cs = by_hash.get(_hash(o.get("outcome")), [])
        verdict_citos = [c for c in cs if c["rel"] in VERDICT_RELS and not c["orig"].startswith("10.5281/")]
        targets = verdict_citos or [c for c in cs if not c["orig"].startswith("10.5281/")]
        repo_doi = _clean_repo(o.get("repo") or "")
        for c in targets:
            index.setdefault(c["orig"], []).append({
                "verdict": _CANON.get((o.get("status") or "").lower(), o.get("status") or "Published"),
                "cito": [c["rel"]],
                "repo_doi": repo_doi,
                "outcome_np": o.get("outcome"),
                "cito_np": c.get("cito"),
            })
    return index
