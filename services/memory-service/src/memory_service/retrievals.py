"""In-memory retrieval observability for the demo dashboard (Panel 4).

A bounded, process-local ring of recent memory searches plus cumulative
per-villager tallies. Fire-and-forget by contract: ``record`` is synchronous,
O(1), and never raises — the search hot path calls it under a guard, so it
must never add latency to nor fail a retrieval. Nothing here is persisted (no
schema, no ledger volume — that is the whole point); the ring is wiped on
restart. Villager NAMES are deliberately absent: memory-service keys on
``villager_id`` only, and the dashboard resolves names client-side via
agent-service (the pattern RaceScoreboard/VillagerGrid already use).
"""

from collections import defaultdict, deque
from datetime import UTC, datetime

_QUERY_PREVIEW_CHARS = 80


class RetrievalLog:
    """Bounded ring + cumulative tallies. Single-writer under asyncio (the
    search coroutine records, the debug endpoint reads); no await sits between
    the mutations, so no lock is needed on the event loop."""

    def __init__(self, ring_size: int = 200) -> None:
        self._recent: deque[dict] = deque(maxlen=ring_size)
        self._per_villager: dict[str, int] = defaultdict(int)
        self._total = 0

    def record(self, villager_id, query: str, k: int, results: int, latency_ms: float) -> None:
        vid = str(villager_id)
        self._recent.append(
            {
                "villagerId": vid,
                "queryPreview": (query or "")[:_QUERY_PREVIEW_CHARS],
                "k": k,
                "results": results,
                "latencyMs": round(latency_ms, 1),
                "at": datetime.now(UTC).isoformat(),
            }
        )
        self._per_villager[vid] += 1
        self._total += 1

    def snapshot(self) -> dict:
        return {
            "total": self._total,
            # newest first for the live feed
            "recent": list(reversed(self._recent)),
            "perVillager": [
                {"villagerId": vid, "count": count} for vid, count in self._per_villager.items()
            ],
        }


# Process-local singleton the app uses; tests construct their own RetrievalLog.
_log = RetrievalLog()


def configure(ring_size: int) -> None:
    """Size the ring from settings at startup (before any retrieval runs)."""
    global _log
    _log = RetrievalLog(ring_size)


def record_retrieval(villager_id, query: str, k: int, results: int, latency_ms: float) -> None:
    _log.record(villager_id, query, k, results, latency_ms)


def snapshot() -> dict:
    return _log.snapshot()
