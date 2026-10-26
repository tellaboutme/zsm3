import csv
from pathlib import Path

import pytest

from zsm3_tools import redirect_sources
from zsm3_tools.redirect_sources import (
    SourceError,
    SourceRow,
    read_csv,
    read_rows,
    read_sitemap,
)

SITEMAP = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://old.example.com/stara</loc></url>
  <url><loc> /druga </loc></url>
  <url><loc>https://old.example.com/podstrona?q=1#frag</loc></url>
  <url><loc></loc></url>
</urlset>
"""


def write_bytes(directory: Path, name: str, content: bytes) -> Path:
    path = directory / name
    path.write_bytes(content)
    return path


def write_text(directory: Path, name: str, content: str) -> Path:
    path = directory / name
    path.write_text(content, encoding="utf-8")
    return path


def test_csv_reads_rows_with_origins(tmp_path: Path) -> None:
    path = write_text(tmp_path, "legacy.csv", "from_path,to_path\n/stara,/nowa\n/druga,/inna\n")

    assert read_csv(path) == [
        SourceRow("/stara", "/nowa", f"{path}:2"),
        SourceRow("/druga", "/inna", f"{path}:3"),
    ]


def test_csv_skips_blank_lines_and_keeps_line_numbers(tmp_path: Path) -> None:
    path = write_text(tmp_path, "legacy.csv", "from_path,to_path\n\n/stara,/nowa\n\n")

    assert read_csv(path) == [SourceRow("/stara", "/nowa", f"{path}:3")]


def test_csv_accepts_quoted_cells(tmp_path: Path) -> None:
    path = write_text(tmp_path, "legacy.csv", 'from_path,to_path\n"/a,x","/b"\n')

    assert read_csv(path) == [SourceRow("/a,x", "/b", f"{path}:2")]


def test_csv_accepts_a_utf_8_bom(tmp_path: Path) -> None:
    path = write_bytes(tmp_path, "legacy.csv", b"\xef\xbb\xbffrom_path,to_path\n/a,/b\n")

    assert read_csv(path) == [SourceRow("/a", "/b", f"{path}:2")]


def test_csv_with_only_a_header_yields_no_rows(tmp_path: Path) -> None:
    path = write_text(tmp_path, "legacy.csv", "from_path,to_path\n")

    assert read_csv(path) == []


def test_csv_rejects_an_empty_file(tmp_path: Path) -> None:
    path = write_bytes(tmp_path, "legacy.csv", b"")

    with pytest.raises(SourceError, match="file is empty"):
        read_csv(path)


def test_csv_rejects_a_missing_header(tmp_path: Path) -> None:
    path = write_text(tmp_path, "legacy.csv", "old,new\n/a,/b\n")

    with pytest.raises(SourceError, match="first row must be from_path,to_path"):
        read_csv(path)


def test_csv_rejects_wrong_column_counts(tmp_path: Path) -> None:
    path = write_text(tmp_path, "legacy.csv", "from_path,to_path\n/a,/b\n/only\n")

    with pytest.raises(SourceError, match="exactly 2 columns"):
        read_csv(path)


def test_csv_rejects_oversized_fields(tmp_path: Path) -> None:
    path = write_text(tmp_path, "legacy.csv", f"from_path,to_path\n{'a' * 64},/c\n")
    previous = csv.field_size_limit()
    csv.field_size_limit(16)
    try:
        with pytest.raises(SourceError, match="field larger than field limit"):
            read_csv(path)
    finally:
        csv.field_size_limit(previous)


def test_read_rows_dispatches_by_suffix(tmp_path: Path) -> None:
    csv_path = write_text(tmp_path, "legacy.csv", "from_path,to_path\n")
    xml_path = write_text(tmp_path, "sitemap.xml", SITEMAP)

    assert read_rows(csv_path, "/target") == []
    assert read_rows(xml_path, "/target") == [
        SourceRow("/stara", "/target", f"{xml_path}#3"),
        SourceRow("/druga", "/target", f"{xml_path}#5"),
        SourceRow("/podstrona", "/target", f"{xml_path}#7"),
        SourceRow("", "/target", f"{xml_path}#9"),
    ]


def test_read_rows_accepts_upper_case_suffixes(tmp_path: Path) -> None:
    csv_path = write_text(tmp_path, "legacy.CSV", "from_path,to_path\n")

    assert read_rows(csv_path, "/target") == []


def test_read_rows_rejects_other_suffixes(tmp_path: Path) -> None:
    path = write_text(tmp_path, "legacy.txt", "from_path,to_path\n")

    with pytest.raises(SourceError, match="unsupported source type"):
        read_rows(path, "/target")


def test_sitemap_keeps_unparsable_urls_for_rejection(tmp_path: Path) -> None:
    path = write_text(
        tmp_path,
        "sitemap.xml",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        "<url><loc>http://[bad</loc></url></urlset>",
    )

    assert read_sitemap(path, "/target") == [SourceRow("http://[bad", "/target", f"{path}#3")]


def test_sitemap_keeps_non_ascii_paths_for_the_warning(tmp_path: Path) -> None:
    path = write_text(
        tmp_path,
        "sitemap.xml",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        "<url><loc>https://old.example.com/ścieżka</loc></url></urlset>",
    )

    assert read_sitemap(path, "/target") == [SourceRow("/ścieżka", "/target", f"{path}#3")]


def test_sitemap_rejects_a_sitemap_index(tmp_path: Path) -> None:
    path = write_text(
        tmp_path,
        "sitemap.xml",
        '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        "<sitemap><loc>other.xml</loc></sitemap></sitemapindex>",
    )

    with pytest.raises(SourceError, match="root element must be urlset"):
        read_sitemap(path, "/target")


def test_sitemap_rejects_broken_xml(tmp_path: Path) -> None:
    path = write_text(tmp_path, "sitemap.xml", "<urlset><url>")

    with pytest.raises(SourceError, match="invalid XML"):
        read_sitemap(path, "/target")


def test_sitemap_rejects_a_missing_root_element(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    path = write_text(tmp_path, "sitemap.xml", SITEMAP)

    class _EmptyTree:
        def getroot(self) -> None:
            return None

    monkeypatch.setattr(redirect_sources, "parse_xml", lambda _source: _EmptyTree())

    with pytest.raises(SourceError, match="root element must be urlset"):
        read_sitemap(path, "/target")
