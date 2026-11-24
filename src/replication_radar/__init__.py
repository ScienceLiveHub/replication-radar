"""Replication Radar — turn the OpenAIRE Graph into a ranked replication queue.

Adds a capability the Graph lacks: 'what high-impact work is worth replicating,
with INDEPENDENT reusable tooling, and has it already been checked?' — joining
OpenAIRE impact + Software Heritage reuse signals + Science Live nanopub verdicts.
"""
from .radar import (
    radar,
    find_dataset,
    find_independent_software,
    replication_status,
    replication_template,
    verified_claims,
)

__all__ = [
    "radar", "find_dataset", "find_independent_software", "replication_status",
    "replication_template", "verified_claims",
]
# The version lives in pyproject.toml only; read it from the installed package.
try:
    from importlib.metadata import PackageNotFoundError, version as _pkg_version

    __version__ = _pkg_version("replication-radar")
except PackageNotFoundError:  # running from a source tree that was never installed
    __version__ = "0+unknown"
