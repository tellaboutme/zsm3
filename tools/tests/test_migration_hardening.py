import unicodedata
from pathlib import PurePosixPath

import pytest

from zsm3_tools.migration_audit import (
    Category,
    Chain,
    Evidence,
    Finding,
    LegacyEntry,
    audit,
    follow,
)
from zsm3_tools.migration_paths import LegacyPathError, legacy_path, lookup_key_of
from zsm3_tools.migration_routes import Route, route_of

PAGE_FILES = ["kontakt.astro", "[section]/index.astro", "[section]/[page].astro", "nowa.astro"]


def routes() -> tuple[Route, ...]:
    found = (route_of(PurePosixPath(name)) for name in PAGE_FILES)
    return tuple(route for route in found if route is not None)


def entry(raw: str) -> LegacyEntry:
    return LegacyEntry(raw, legacy_path(raw))


def category(raw: str, redirects: dict[str, str], statuses: dict[str, int]) -> Finding:
    [finding] = audit([entry(raw)], redirects, {}, Evidence(routes(), statuses))
    return finding


@pytest.mark.parametrize("target", ["/panel", "/panel/linki", "/api/questions", "/media", "/PANEL"])
def test_a_target_under_a_reserved_prefix_is_refused_like_the_worker(target: str) -> None:
    statuses = {"/stary": 404, target: 200}

    finding = category("/stary", {"/stary": target}, statuses)

    assert (finding.category, finding.target) == (Category.MAPPED_RESERVED, target)


def test_a_reserved_hop_inside_a_chain_ends_it() -> None:
    redirects = {"/a": "/b", "/b": "/panel", "/panel": "/kontakt"}

    assert follow(redirects, "/a", Evidence(routes(), {"/b": 404})) == Chain(
        "/panel", 2, Category.MAPPED_RESERVED
    )
    assert category("/a", redirects, {"/a": 404, "/b": 404}).category is Category.MAPPED_RESERVED


def test_public_and_authorised_pages_keep_their_meaning() -> None:
    assert category("/stary", {"/stary": "/kontakt"}, {"/stary": 404, "/kontakt": 200}) == Finding(
        "/stary", Category.MAPPED, "/kontakt", ("/stary",), ()
    )
    assert category("/panel/stary", {}, {}).category is Category.NOT_REDIRECTABLE


@pytest.mark.parametrize("status", [500, 502, 503, 504, 429])
def test_a_failing_preview_is_never_read_as_a_missing_page(status: int) -> None:
    assert category("/kontakt-stary", {}, {"/kontakt-stary": status}) == Finding(
        "/kontakt-stary", Category.PROBE_ERROR, None, ("/kontakt-stary",), ()
    )


@pytest.mark.parametrize("status", [500, 503])
def test_a_redirect_to_a_failing_destination_is_a_probe_error(status: int) -> None:
    redirects = {"/stary": "/b", "/b": "/kontakt"}

    direct = category("/stary", {"/stary": "/nowa"}, {"/stary": 404, "/nowa": status})
    hop = category("/stary", redirects, {"/stary": 404, "/b": status, "/kontakt": 200})

    assert (direct.category, direct.target) == (Category.PROBE_ERROR, "/nowa")
    assert (hop.category, hop.target) == (Category.PROBE_ERROR, "/b")


def test_definite_answers_still_mean_not_served() -> None:
    for status in (301, 302, 404, 410, 403):
        assert category("/a/b/c", {}, {"/a/b/c": status}).category is Category.MISSING


def test_probe_errors_rank_before_every_other_finding() -> None:
    assert next(iter(Category)) is Category.PROBE_ERROR


@pytest.mark.parametrize(
    ("raw", "sent", "key"),
    [
        ("/archiwum/a%2Fb", "/archiwum/a%2Fb", "/archiwum/a%2fb"),
        ("/archiwum/a%2fb/", "/archiwum/a%2fb/", "/archiwum/a%2fb"),
        ("/Zaj%C4%99cia", "/Zaj%C4%99cia", "/zaj%c4%99cia"),
        ("/zajęcia", "/zaj%C4%99cia", "/zaj%c4%99cia"),
        ("/a%41", "/a%41", "/a%41"),
        ("/100%", "/100%", "/100%"),
        ("/a%zz/", "/a%zz/", "/a%zz"),
        ("/[x]|^", "/[x]|^", "/[x]|^"),
        ('/a"b<c>`{d}', "/a%22b%3Cc%3E%60%7Bd%7D", "/a%22b%3cc%3e%60%7bd%7d"),
    ],
)
def test_paths_are_encoded_the_way_a_browser_sends_them(raw: str, sent: str, key: str) -> None:
    path = legacy_path(raw)

    assert (path.request_path, path.lookup_key) == (sent, key)


def test_an_encoded_slash_stays_a_different_path_from_a_real_one() -> None:
    findings = audit(
        [entry("/archiwum/a%2Fb"), entry("/archiwum/a/b")],
        {"/archiwum/a%2fb": "/nowa"},
        {},
        Evidence(routes(), {"/archiwum/a%2Fb": 404, "/archiwum/a/b": 404, "/nowa": 200}),
    )

    assert [(f.key, f.category) for f in findings] == [
        ("/archiwum/a/b", Category.MISSING),
        ("/archiwum/a%2fb", Category.MAPPED),
    ]


def test_unicode_forms_stay_distinct_because_the_worker_does_not_normalise() -> None:
    composed = "/zaj" + unicodedata.normalize("NFC", "ę") + "cia"
    decomposed = "/zaj" + unicodedata.normalize("NFD", "ę") + "cia"

    assert lookup_key_of(composed) == "/zaj%c4%99cia"
    assert lookup_key_of(decomposed) == "/zaje%cc%a8cia"


def test_an_encoded_map_row_is_not_reported_as_unencoded() -> None:
    finding = category("/a%2Fb", {"/a%2fb": "/nowa"}, {"/a%2Fb": 404, "/nowa": 200})

    assert finding.category is Category.MAPPED


@pytest.mark.parametrize("raw", ["/a\\b", "/%2e%2e/x"])
def test_ambiguous_separators_are_rejected(raw: str) -> None:
    with pytest.raises(LegacyPathError):
        legacy_path(raw)
