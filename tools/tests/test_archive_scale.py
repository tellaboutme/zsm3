import tracemalloc
from pathlib import Path

from archive_fixtures import archive, write
from zsm3_tools.archive_discovery import discover
from zsm3_tools.archive_manifest import build
from zsm3_tools.archive_model import Settings
from zsm3_tools.archive_permissions import Permissions
from zsm3_tools.archive_pipeline import process
from zsm3_tools.archive_store import Store
from zsm3_tools.archive_validate import validate

ALBUMS = 20
PER_ALBUM = 5
COPIES = 15
PEAK_BYTES = 64 << 20


def test_a_large_synthetic_archive_with_duplicates_processes_in_bounded_memory(
    tmp_path: Path,
) -> None:
    source = tmp_path / "source"
    files = archive(source, ALBUMS, PER_ALBUM)
    for index, (relative, data) in enumerate(sorted(files.items())[:COPIES]):
        write(source, f"2030-2031/kopie/{index:02d} {relative.rsplit('/', 1)[-1]}", data)
    settings = Settings()
    inventory = discover(source, settings)
    store = Store(tmp_path / "out", settings)
    store.prepare()
    seen: list[int] = []

    tracemalloc.start()
    results = process(source, inventory, store, lambda done, _: seen.append(done))
    _, peak = tracemalloc.get_traced_memory()
    tracemalloc.stop()
    manifest = build(inventory, results, Permissions(), settings, "synthetic")

    assert len(results) == ALBUMS * PER_ALBUM + COPIES
    assert seen == list(range(1, len(results) + 1))
    assert peak < PEAK_BYTES
    summary = manifest["summary"]
    assert isinstance(summary, dict)
    assert summary["outcomes"]["duplicate"] == COPIES
    assert summary["outcomes"]["eligible"] == 0
    assert validate(manifest, store.variants) == []
    resumed = process(source, inventory, store, lambda *_: None)
    assert all(result.reused for result in resumed)
