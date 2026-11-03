import json
from pathlib import Path

import pytest

from zsm3_tools import migration_inputs
from zsm3_tools.migration_inputs import (
    InputError,
    Rejected,
    read_inventory,
    read_map,
    read_paths,
    read_sitemap_paths,
    read_unresolved,
    read_url_list,
)


def write(path: Path, text: str) -> Path:
    path.write_text(text, encoding="utf-8", newline="\n")
    return path


def test_an_inventory_keeps_its_old_status_and_rejects_unusable_entries(tmp_path: Path) -> None:
    payload = [
        {"url": "https://www.example.edu.pl/rekrutacja/", "status": "discovered"},
        {"url": "mailto:a@example.edu.pl", "status": "discovered"},
        {"url": "/kontakt"},
        "/plain-string",
    ]
    source = write(tmp_path / "inventory.json", json.dumps(payload))

    loaded = read_inventory(source)

    assert [(entry.path.lookup_key, entry.old_status) for entry in loaded.items] == [
        ("/rekrutacja", "discovered")
    ]
    assert loaded.rejected == (
        Rejected(f"{source}#2", "mailto:a@example.edu.pl", "not a site path or web address"),
        Rejected(f"{source}#3", "", "entry needs string url and status"),
        Rejected(f"{source}#4", "", "entry needs string url and status"),
    )


@pytest.mark.parametrize(
    ("text", "message"),
    [("{]", "invalid JSON"), ('{"url": "/"}', "expected a JSON array")],
)
def test_an_inventory_must_be_a_json_array(tmp_path: Path, text: str, message: str) -> None:
    with pytest.raises(InputError, match=message):
        read_inventory(write(tmp_path / "inventory.json", text))


def test_a_url_list_skips_comments_and_blank_lines(tmp_path: Path) -> None:
    source = write(tmp_path / "urls.txt", "# eksport\n\n/stara/\nzla sciezka\n/nowa\n")

    loaded = read_url_list(source)

    assert [entry.source for entry in loaded.items] == ["/stara/", "/nowa"]
    assert loaded.rejected == (
        Rejected(f"{source}:4", "zla sciezka", "empty or contains whitespace"),
    )


def test_a_map_is_validated_like_the_importer_and_rejects_duplicates(tmp_path: Path) -> None:
    source = write(
        tmp_path / "map.csv",
        "from_path,to_path\n/Stara/,/nowa\n/stara,/inna\nstara,/nowa\n/x,/X\n",
    )

    loaded = read_map(source)

    assert loaded.items == {"/stara": "/nowa"}
    assert [(row.value, row.reason) for row in loaded.rejected] == [
        ("/stara", "duplicate once normalised"),
        ("stara", "from path must start with /"),
        ("/x", "to path must be an internal site path"),
    ]


def test_a_map_without_the_header_is_an_input_error(tmp_path: Path) -> None:
    with pytest.raises(InputError, match="first row"):
        read_map(write(tmp_path / "map.csv", "a,b\n"))


def test_unresolved_rows_are_keyed_like_lookups(tmp_path: Path) -> None:
    source = write(
        tmp_path / "unresolved.csv",
        "from_path,previous_to_path,reason\n/Tatry/,/uczniowie,archive\n\n",
    )

    assert read_unresolved(source) == {"/tatry": "archive"}
    with pytest.raises(InputError, match="first row"):
        read_unresolved(write(tmp_path / "bad.csv", "from_path,reason\n"))
    with pytest.raises(InputError, match="exactly 3 columns"):
        read_unresolved(write(tmp_path / "short.csv", "from_path,previous_to_path,reason\n/a,/b\n"))


def test_paths_and_sitemaps_give_path_sets(tmp_path: Path) -> None:
    paths = write(tmp_path / "cms.txt", "/kontakt\n  /szkola/historia \nbez-ukosnika\n")
    sitemap = write(
        tmp_path / "sitemap.xml",
        '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'
        "<url><loc>https://zsm3.example/kontakt</loc></url>"
        "<url><loc>https://zsm3.example/</loc></url></urlset>",
    )

    assert read_paths(paths) == frozenset({"/kontakt", "/szkola/historia"})
    assert read_sitemap_paths(sitemap) == frozenset({"/kontakt", "/"})
    with pytest.raises(InputError, match="root element"):
        read_sitemap_paths(write(tmp_path / "index.xml", "<sitemapindex/>"))


def test_unreadable_or_oversized_input_is_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    with pytest.raises(InputError, match="unreadable"):
        read_paths(tmp_path / "missing.txt")
    binary = tmp_path / "binary.txt"
    binary.write_bytes(b"\xff\xfe\x00")
    with pytest.raises(InputError, match="unreadable"):
        read_paths(binary)
    monkeypatch.setattr(migration_inputs, "MAX_INPUT_BYTES", 4)
    with pytest.raises(InputError, match="larger than 4 bytes"):
        read_paths(write(tmp_path / "big.txt", "/abcdef\n"))
