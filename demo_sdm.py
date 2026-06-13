"""Live vertical-slice demo: the Replication Radar on Species Distribution Models.

Runs against the real OpenAIRE Graph API (anonymous). Proves the full pipeline:
impact-ranked targets + independent tooling + reference data + verified-overlay.

    PYTHONPATH=src python3 demo_sdm.py
"""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "src"))

from replication_radar import radar, find_independent_software, replication_status  # noqa: E402


def hr(t):
    print("\n" + "=" * 72 + f"\n {t}\n" + "=" * 72)


hr("radar('species distribution') — replication targets in the field")
r = radar("species distribution", limit=8)
print(f"topic: {r['topic']}   OPEN: {r['open_count']}   VERIFIED: {r['verified_count']}\n")
for i, t in enumerate(r["targets"], 1):
    imp = t["impact"]
    print(f"{i:>2}. [{t['status']:8}] {(t['title'] or '')[:58]:58}  {t['citations']:>5} cites  "
          f"cit:{imp['citationClass']} inf:{imp['influenceClass']}")
    print(f"      doi: {t['doi']}")
    if t["status"] == "VERIFIED":
        print(f"      -> {t['verification']}")
    elif t["independent_tooling"]:
        tl = t["independent_tooling"][0]
        print(f"      independent tooling avail: {(tl['title'] or '')[:46]}  swh={tl['swh']}")

print("\nfunder context (field-level):")
fc = r["funder_context"]
print(f"  projects in field: {fc['projects_in_field']}")
for f in fc["top_funders"]:
    print(f"   - {f['name'][:42]:42} {f['jurisdiction'] or '--':4} EUR {f['funded_eur']:,}")

hr("find_independent_software(Phillips 2009 = 10.1890/07-2153.1)")
fs = find_independent_software(doi="10.1890/07-2153.1", topic="species distribution")
print(f"original authors: {fs['original_authors']}")
print(f"independent tools found: {fs['independent_count']} / {len(fs['software'])}\n")
for s in fs["software"][:6]:
    flag = "INDEP" if s["independent"] else "rooted"
    print(f"  [{flag}] reuse={s['reuse_score']}  {(s['title'] or '')[:50]:50}  authors={s['authors'][:2]}")

hr("replication_status() — the verified-overlay the Graph cannot hold")
for doi in ["10.1890/07-2153.1", "10.1073/pnas.0704469104", "10.1126/science.aax8591", "10.9999/not.replicated"]:
    st = replication_status(doi)
    print(f"  {doi:28} -> {st['summary']}")
