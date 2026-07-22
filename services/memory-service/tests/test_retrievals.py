"""Unit proof for the in-memory retrieval ring (demo dashboard, Panel 4):
bounded, newest-first, per-villager tallies, tolerant of thin input. No
container needed — this is pure in-process state."""

from memory_service.retrievals import RetrievalLog


def test_ring_is_bounded_and_evicts_oldest():
    log = RetrievalLog(ring_size=3)
    for i in range(5):
        log.record(f"v{i}", f"q{i}", k=10, results=i, latency_ms=1.0)
    snap = log.snapshot()
    # total counts every call; the ring keeps only the last three, newest first
    assert snap["total"] == 5
    assert [e["queryPreview"] for e in snap["recent"]] == ["q4", "q3", "q2"]


def test_query_preview_is_truncated():
    log = RetrievalLog()
    log.record("v", "x" * 500, k=1, results=0, latency_ms=0.0)
    assert len(log.snapshot()["recent"][0]["queryPreview"]) == 80


def test_record_tolerates_missing_query_and_villager():
    log = RetrievalLog()
    log.record(None, None, k=10, results=0, latency_ms=1.5)  # must not raise
    entry = log.snapshot()["recent"][0]
    assert entry["villagerId"] == "None"
    assert entry["queryPreview"] == ""


def test_snapshot_tallies_per_villager():
    log = RetrievalLog()
    log.record("alice", "coal", k=5, results=3, latency_ms=12.0)
    log.record("alice", "iron", k=5, results=2, latency_ms=9.0)
    log.record("bob", "wood", k=5, results=1, latency_ms=4.04)
    snap = log.snapshot()
    assert snap["total"] == 3
    assert {row["villagerId"]: row["count"] for row in snap["perVillager"]} == {"alice": 2, "bob": 1}
    latest = snap["recent"][0]  # newest first
    assert latest["villagerId"] == "bob"
    assert latest["results"] == 1
    assert latest["latencyMs"] == 4.0  # rounded to one decimal
