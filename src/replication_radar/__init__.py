"""Replication Radar — turn the OpenAIRE Graph into a ranked replication queue.

Adds a capability the Graph lacks: 'what high-impact work is worth replicating,
with INDEPENDENT reusable tooling, and has it already been checked?' — joining
OpenAIRE impact + Software Heritage reuse signals + Science Live nanopub verdicts.
"""
from .radar import radar, find_independent_software, replication_status

__all__ = ["radar", "find_independent_software", "replication_status"]
__version__ = "0.1.0"
