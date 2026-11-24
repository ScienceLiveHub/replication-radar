"""Keep the release version in ONE place: pyproject.toml.

The package reads its own version at runtime (importlib.metadata), so only two
files still need the literal number, because external services read them straight
from the repository: CITATION.cff (Zenodo) and server.json (MCP Registry).
This script writes them from pyproject.toml, or checks that they agree.

    python scripts/set_version.py 0.5.0     # set pyproject.toml, then sync the others
    python scripts/set_version.py           # sync CITATION.cff + server.json from pyproject.toml
    python scripts/set_version.py --check   # exit 1 if anything disagrees
    python scripts/set_version.py --check --tag v0.5.0   # also compare with the release tag
"""
from __future__ import annotations

import argparse
import datetime as dt
import json
import re
import sys
import tomllib
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PYPROJECT = ROOT / "pyproject.toml"
CITATION = ROOT / "CITATION.cff"
SERVER = ROOT / "server.json"


def pyproject_version() -> str:
    return tomllib.loads(PYPROJECT.read_text())["project"]["version"]


def set_pyproject(version: str) -> None:
    text = PYPROJECT.read_text()
    new, n = re.subn(r'(?m)^version = "[^"]*"', f'version = "{version}"', text, count=1)
    if n != 1:
        sys.exit("pyproject.toml: no `version = \"...\"` line found")
    PYPROJECT.write_text(new)


def citation_version() -> str | None:
    m = re.search(r'(?m)^version:\s*"?([^"\s]+)"?\s*$', CITATION.read_text())
    return m.group(1) if m else None


def server_versions() -> list[str]:
    data = json.loads(SERVER.read_text())
    return [data.get("version")] + [p.get("version") for p in data.get("packages", [])]


def sync(version: str) -> None:
    cff = CITATION.read_text()
    cff = re.sub(r'(?m)^version:.*$', f"version: {version}", cff, count=1)
    cff = re.sub(r'(?m)^date-released:.*$', f'date-released: "{dt.date.today().isoformat()}"', cff, count=1)
    CITATION.write_text(cff)
    # Only the top-level and package `"version"` keys exist in server.json; edit in place
    # (no JSON re-dump) so the diff stays one line per version.
    srv = re.sub(r'("version"\s*:\s*")[^"]*(")', rf"\g<1>{version}\g<2>", SERVER.read_text())
    SERVER.write_text(srv)


def check(tag: str | None) -> int:
    want = pyproject_version()
    found = {"CITATION.cff": [citation_version()], "server.json": server_versions()}
    if tag:
        found["git tag"] = [tag.removeprefix("v")]
    bad = {k: v for k, v in found.items() if any(x != want for x in v)}
    if bad:
        print(f"Version mismatch: pyproject.toml says {want}, but {bad}. "
              f"Run `python scripts/set_version.py` and commit.", file=sys.stderr)
        return 1
    print(f"Versions agree: {want}")
    return 0


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("version", nargs="?", help="new version (writes pyproject.toml first)")
    ap.add_argument("--check", action="store_true", help="only check; exit 1 on mismatch")
    ap.add_argument("--tag", help="release tag to compare against, e.g. v0.5.0")
    a = ap.parse_args()
    if a.check:
        return check(a.tag)
    if a.version:
        set_pyproject(a.version)
    sync(pyproject_version())
    return check(None)


if __name__ == "__main__":
    sys.exit(main())
