import csv
import sqlite3
from pathlib import Path

from zsm3_tools.redirect_import import import_sql, plan_import
from zsm3_tools.redirect_sources import read_csv

CORPUS = Path(__file__).resolve().parents[1] / "data" / "legacy-url-map.csv"
UNRESOLVED = CORPUS.with_name("legacy-url-unresolved.csv")


def test_legacy_url_map_imports_without_rejections_or_duplicate_paths() -> None:
    rows = read_csv(CORPUS)
    plan = plan_import(rows, {}, update=False)

    assert len(rows) == 57
    assert len(plan.imported) == len(rows)
    assert not plan.rejected
    assert not plan.conflicts
    assert not plan.warnings

    connection = sqlite3.connect(":memory:")
    try:
        connection.execute(
            "CREATE TABLE redirects ("
            "from_path TEXT PRIMARY KEY CHECK (from_path GLOB '/*'), "
            "to_path TEXT NOT NULL CHECK (to_path GLOB '/*' AND to_path <> from_path), "
            "created_at TEXT NOT NULL)"
        )
        connection.executescript(import_sql(plan, "2026-10-26T00:00:00Z"))
        imported = dict(connection.execute("SELECT from_path, to_path FROM redirects"))
    finally:
        connection.close()

    assert len(imported) == len(rows)
    assert imported["/rekrutacja-zsm3"] == "/kandydaci/rekrutacja"
    assert imported["/2026/10/17/swiatowy-dzien-przywracania-czynnosci-serca"] == (
        "/aktualnosci/2026/swiatowy-dzien-przywracania-czynnosci-serca"
    )


def test_legacy_url_map_is_idempotent() -> None:
    rows = read_csv(CORPUS)
    first = plan_import(rows, {}, update=False)
    existing = {row.from_path: row.to_path for row in first.imported}
    second = plan_import(rows, existing, update=False)

    assert len(second.skipped) == len(rows)
    assert not second.imported
    assert not second.conflicts
    assert not second.rejected


def test_unresolved_sources_are_accounted_for_without_importing_them() -> None:
    mapped = {row.raw_from for row in read_csv(CORPUS)}
    with UNRESOLVED.open(encoding="utf-8", newline="") as handle:
        unresolved = list(csv.DictReader(handle))
    sources = {row["from_path"] for row in unresolved}

    assert len(mapped) == 57
    assert len(unresolved) == len(sources) == 49
    assert not mapped.intersection(sources)
    assert all(row["reason"] and row["previous_to_path"] for row in unresolved)
    assert {"/wychowawcy-klas/", "/rodo/"}.issubset(sources)
