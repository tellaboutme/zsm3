import re
from pathlib import Path

import pytest

from zsm3_tools.migration_paths import (
    FILE_SUFFIXES,
    MAX_PATH_LENGTH,
    RESERVED_PREFIXES,
    LegacyPath,
    LegacyPathError,
    is_document,
    is_redirectable,
    is_reserved,
    legacy_path,
    suffix_of,
)

WORKER_LOOKUP = (
    Path(__file__).resolve().parents[2] / "apps" / "web" / "worker" / "legacy-redirect.ts"
)


def test_a_web_address_and_its_path_give_the_same_lookup_key() -> None:
    expected = LegacyPath("/Rekrutacja-ZSM3/", "/rekrutacja-zsm3", had_query=False)

    assert legacy_path("https://www.example.edu.pl/Rekrutacja-ZSM3/") == expected
    assert legacy_path("/Rekrutacja-ZSM3/") == expected
    assert legacy_path("  /Rekrutacja-ZSM3/#top ") == expected


def test_polish_characters_are_encoded_the_way_browsers_request_them() -> None:
    path = legacy_path("/zajęcia-pozalekcyjne/")

    assert path.request_path == "/zaj%C4%99cia-pozalekcyjne/"
    assert path.lookup_key == "/zaj%c4%99cia-pozalekcyjne"
    assert legacy_path("/zaj%C4%99cia-pozalekcyjne/") == path


def test_the_query_is_dropped_but_remembered() -> None:
    assert legacy_path("/?page_id=42") == LegacyPath("/", "/", had_query=True)
    assert legacy_path("https://www.example.edu.pl") == LegacyPath("/", "/", had_query=False)


@pytest.mark.parametrize(
    ("raw", "reason"),
    [
        ("", "empty or contains whitespace"),
        ("/stara strona", "empty or contains whitespace"),
        ("mailto:sekretariat@example.edu.pl", "not a site path or web address"),
        ("ftp://example.edu.pl/plik", "not a site path or web address"),
        ("strona", "not a site path or web address"),
        ("/a/../wp-admin", "contains dot segments"),
        ("/" + "a" * MAX_PATH_LENGTH, f"longer than {MAX_PATH_LENGTH} characters once encoded"),
    ],
)
def test_unusable_input_is_refused_with_a_reason(raw: str, reason: str) -> None:
    with pytest.raises(LegacyPathError, match=re.escape(reason)):
        legacy_path(raw)


def test_suffixes_reserved_prefixes_and_documents() -> None:
    assert suffix_of("/plan.PDF") == "pdf"
    assert suffix_of("/skrypt.min.js") == "js"
    assert suffix_of("/plik.p-d") == ""
    assert suffix_of("/szkola") == ""
    assert is_reserved("/panel")
    assert is_reserved("/API/short-links")
    assert not is_reserved("/panelowy")
    assert not is_redirectable("/wp-content/uploads/plan.pdf")
    assert not is_redirectable("/media/d/plik")
    assert is_redirectable("/wp-content/uploads/plan.docx")
    assert is_document("/wp-content/uploads/plan.docx")
    assert is_document("/plan.pdf")
    assert not is_document("/logo.png")


def test_the_rules_match_the_worker_legacy_lookup() -> None:
    source = WORKER_LOOKUP.read_text(encoding="utf-8")
    pattern = re.search(r"\\\.\(\?:([a-z0-9?|]+)\)\$", source)
    prefixes = re.search(r"\[(\"/api\"[^\]]*)\]\.every", source)

    assert pattern is not None
    assert prefixes is not None
    suffixes: set[str] = set()
    for alternative in pattern.group(1).split("|"):
        optional = re.fullmatch(r"(.*?)(.)\?(.*)", alternative)
        if optional is None:
            suffixes.add(alternative)
        else:
            head, letter, tail = optional.groups()
            suffixes |= {head + tail, head + letter + tail}
    assert suffixes == set(FILE_SUFFIXES)
    assert tuple(re.findall(r'"(/[^"]+)"', prefixes.group(1))) == RESERVED_PREFIXES
