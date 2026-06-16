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
# CiTO relations that are METHOD/DATA/CREDIT provenance — they point to a SOURCE paper, not a
# verdict on it. A verdict must NEVER attach via these: a study that `usesMethodIn` Phillips 2009
# and was Contradicted does not contradict Phillips 2009 (it reused its method). (lowercased compare)
NONVERDICT_RELS = {"usesmethodin", "usesdatafrom", "citesasdatasource", "citesasevidence", "credits",
                   "citesforinformation", "obtainsbackgroundfrom", "obtainssupportfrom", "citesasauthority",
                   "citesasrelated", "citesassourcedocument", "includesquotationfrom", "sharesauthorinstitutionwith"}
_CANON = {"validated": "Validated", "partiallysupported": "PartiallySupported", "contradicted": "Contradicted",
          "notsupported": "NotSupported", "mixed": "Mixed", "inconclusive": "Inconclusive"}
_TIMEOUT = float(os.environ.get("RADAR_HTTP_TIMEOUT", "30"))

_QA = f"""PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX slt: <https://w3id.org/sciencelive/o/terms/>
SELECT DISTINCT ?outcome ?status ?repo WHERE {{ GRAPH ?g {{ ?outcome ntpl:wasCreatedFromTemplate <{TPL_OUTCOME}> . }} ?outcome np:hasAssertion ?oa . GRAPH ?oa {{ ?oc slt:hasValidationStatus ?s . OPTIONAL {{ ?oc slt:hasOutcomeRepository ?repo . }} }} BIND(STRAFTER(STR(?s),"/terms/") AS ?status) }}"""

_QB = f"""PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX cito: <http://purl.org/spar/cito/>
SELECT DISTINCT ?cito ?subj ?rel ?orig WHERE {{ GRAPH ?g {{ ?cito ntpl:wasCreatedFromTemplate <{TPL_CITO}> . }} ?cito np:hasAssertion ?ca . GRAPH ?ca {{ ?subj ?rel ?orig . }} FILTER(STRSTARTS(STR(?rel),STR(cito:))) FILTER(CONTAINS(STR(?orig),"doi.org/10.")) }} LIMIT 3000"""

# Validity guard, run as its OWN lightweight query (anchored on the Outcome template, so it stays
# fast — anchoring on two templates, or an inline FILTER NOT EXISTS on the full repo, times the
# endpoint out at 504). Returns OUR Outcomes that have been retracted / invalidated / superseded by
# a nanopub from the SAME creator. Same-creator is essential: only the original author can retract
# their own work — a third party publishing `retracts` must not be able to suppress someone else's.
# Disapproval (`disapprovesOf`) is deliberately NOT here: that is a third party disagreeing, not a
# retraction, so it must never hide a verdict. (Only Outcomes are affected in the current network;
# extend VALUES ?tpl to the CiTO template if a superseded CiTO ever appears — but keep it one
# query per template to stay under the endpoint timeout.)
_QV = f"""PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX npx: <http://purl.org/nanopub/x/> PREFIX dct: <http://purl.org/dc/terms/>
SELECT DISTINCT ?np WHERE {{ GRAPH ?g {{ ?np ntpl:wasCreatedFromTemplate <{TPL_OUTCOME}> . }} GRAPH ?supg {{ ?sup ?act ?np . }} VALUES ?act {{ npx:retracts npx:invalidates npx:supersedes }} GRAPH ?cg1 {{ ?sup dct:creator ?cc . }} GRAPH ?cg2 {{ ?np dct:creator ?cc . }} }}"""

# What EXACTLY was replicated: traverse Outcome →isOutcomeOf→ Study →targetsClaim→ Claim, reading
# the claim's AIDA statement (the atomic claim sentence) and its FORRT claim type.
_QC = f"""PREFIX np: <http://www.nanopub.org/nschema#> PREFIX ntpl: <https://w3id.org/np/o/ntemplate/> PREFIX slt: <https://w3id.org/sciencelive/o/terms/> PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
SELECT DISTINCT ?outcome ?claimLabel ?aida ?ctype WHERE {{ GRAPH ?og {{ ?outcome ntpl:wasCreatedFromTemplate <{TPL_OUTCOME}> . }} ?outcome np:hasAssertion ?oa . GRAPH ?oa {{ ?oc slt:isOutcomeOf ?study . }} GRAPH ?sg {{ ?study slt:targetsClaim ?claim . }} GRAPH ?cg {{ ?claim rdfs:label ?claimLabel . }} OPTIONAL {{ GRAPH ?cg {{ ?claim slt:asAidaStatement ?aida . }} }} OPTIONAL {{ GRAPH ?cg {{ ?claim a ?ctype . FILTER(CONTAINS(STR(?ctype),"-FORRT-Claim")) }} }} }} LIMIT 500"""


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


def _aida(uri: str) -> str:
    """The AIDA sentence from its URI (…/aida/<url-encoded sentence>)."""
    if not uri:
        return ""
    return urllib.parse.unquote(re.sub(r".*/aida/", "", uri).replace("+", " ")).strip()


def _claim_type(uri: str) -> str:
    """FORRT claim type from its URI, e.g. …/Descriptive_pattern-FORRT-Claim -> 'Descriptive pattern'."""
    if not uri:
        return ""
    t = re.sub(r"-FORRT-Claim$", "", re.sub(r".*[/#]", "", uri))
    return t.replace("_", " ").strip()


def _clean_repo(repo: str) -> str | None:
    if not repo:
        return None
    if "doi.org/" in repo:
        return _doi(repo)
    return repo.lower() if repo.startswith("10.") else repo


@lru_cache(maxsize=1)
def build_index() -> dict:
    """{doi: [ {verdict, cito[], repo_doi, outcome_np, cito_np, claim} ]} — network-wide, author-agnostic.

    `claim` (best-effort) = {label, aida, type}: the FORRT Claim the Outcome targets, i.e. what
    EXACTLY was replicated — the atomic AIDA sentence and its claim type.

    Raises on network/parse failure so callers can fall back to the bundled index.
    """
    outcomes = _sparql(_QA)        # sequential: concurrent queries truncate the endpoint
    citos = _sparql(_QB)
    try:                                                   # best-effort: a guard timeout must not
        invalid = {_hash(r.get("np")) for r in _sparql(_QV)}   # take down live verdicts
    except Exception:
        invalid = set()
    claims: dict[str, dict] = {}                           # best-effort: claim traversal is optional
    try:
        for r in _sparql(_QC):
            h = _hash(r.get("outcome"))
            if h not in claims:
                claims[h] = {
                    "label": r.get("claimLabel") or "",
                    "aida": _aida(r.get("aida")),
                    "type": _claim_type(r.get("ctype")),
                }
    except Exception:
        claims = {}
    by_hash: dict[str, list] = {}
    for r in citos:
        by_hash.setdefault(_hash(r.get("subj")), []).append({
            "rel": re.sub(r".*cito/", "", r.get("rel", "")),
            "orig": _doi(r.get("orig")),
            "cito": r.get("cito"),
        })
    index: dict[str, list] = {}
    for o in outcomes:
        if _hash(o.get("outcome")) in invalid:             # drop a superseded/retracted Outcome
            continue
        cs = by_hash.get(_hash(o.get("outcome")), [])
        verdict_citos = [c for c in cs if c["rel"] in VERDICT_RELS and not c["orig"].startswith("10.5281/")]
        targets = verdict_citos or [c for c in cs if c["rel"].lower() not in NONVERDICT_RELS and not c["orig"].startswith("10.5281/")]
        repo_doi = _clean_repo(o.get("repo") or "")
        for c in targets:
            index.setdefault(c["orig"], []).append({
                "verdict": _CANON.get((o.get("status") or "").lower(), o.get("status") or "Published"),
                "cito": [c["rel"]],
                "repo_doi": repo_doi,
                "outcome_np": o.get("outcome"),
                "cito_np": c.get("cito"),
                "claim": claims.get(_hash(o.get("outcome"))) or {},
            })
    return index
