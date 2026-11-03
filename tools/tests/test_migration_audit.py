from pathlib import PurePosixPath

import pytest

from zsm3_tools.migration_audit import (
    MAX_CHAIN,
    Category,
    Chain,
    Evidence,
    Finding,
    LegacyEntry,
    audit,
    categorise,
    follow,
)
from zsm3_tools.migration_paths import legacy_path
from zsm3_tools.migration_routes import Route, route_of

PAGE_FILES = ["kontakt.astro", "[section]/index.astro", "[section]/[page].astro", "nowa.astro"]


def routes() -> tuple[Route, ...]:
    found = (route_of(PurePosixPath(name)) for name in PAGE_FILES)
    return tuple(route for route in found if route is not None)


def entry(raw: str, status: str = "") -> LegacyEntry:
    return LegacyEntry(raw, legacy_path(raw), status)


STATIC = Evidence(routes())


@pytest.mark.parametrize(
    ("raw", "redirects", "unresolved", "expected"),
    [
        ("/wp-content/uploads/plan.pdf", {}, {}, (Category.DOCUMENT_REVIEW, None)),
        ("/wp-content/themes/a/logo.png", {}, {}, (Category.NOT_REDIRECTABLE, None)),
        ("/kontakt/", {"/kontakt": "/nowa"}, {}, (Category.MAPPED_SHADOWED, "/nowa")),
        ("/stara/", {"/stara": "/nowa"}, {}, (Category.MAPPED, "/nowa")),
        ("/stara/", {"/stara": "/a/b"}, {}, (Category.MAPPED_UNVERIFIED, "/a/b")),
        ("/stara/", {"/stara": "/a/b/c"}, {}, (Category.MAPPED_TARGET_MISSING, "/a/b/c")),
        ("/stara/", {"/stara": "/x/y", "/x/y": "/nowa"}, {}, (Category.MAPPED_CHAIN, "/nowa")),
        ("/stara/", {"/stara": "/x/y", "/x/y": "/stara"}, {}, (Category.MAPPED_LOOP, None)),
        ("/tatry/", {}, {"/tatry": "archive"}, (Category.UNRESOLVED, "archive")),
        ("/kontakt", {}, {}, (Category.LIVE_SAME_PATH, None)),
        ("/rodo/", {}, {}, (Category.UNVERIFIED, None)),
        ("/a/b/c/", {}, {}, (Category.MISSING, None)),
    ],
)
def test_each_legacy_path_falls_into_one_category(
    raw: str,
    redirects: dict[str, str],
    unresolved: dict[str, str],
    expected: tuple[Category, str | None],
) -> None:
    assert categorise(legacy_path(raw), redirects, unresolved, STATIC) == expected


def test_local_preview_statuses_override_the_route_table() -> None:
    probed = Evidence(routes(), {"/rodo/": 200, "/a/b": 404, "/kontakt": 404})

    assert categorise(legacy_path("/rodo/"), {}, {}, probed) == (Category.LIVE_SAME_PATH, None)
    assert categorise(legacy_path("/x"), {"/x": "/a/b"}, {}, probed) == (
        Category.MAPPED_TARGET_MISSING,
        "/a/b",
    )
    assert categorise(legacy_path("/kontakt"), {"/kontakt": "/nowa"}, {}, probed) == (
        Category.MAPPED,
        "/nowa",
    )


def test_a_chain_stops_where_the_worker_finds_a_served_page() -> None:
    redirects = {"/a": "/kontakt", "/kontakt": "/nowa"}

    assert follow(redirects, "/a", STATIC) == Chain("/kontakt", 1)
    assert follow({"/a": "/b", "/b": "/c", "/c": "/d"}, "/a", STATIC) == Chain("/d", 3)
    assert follow({"/a": "/b", "/b": "/a"}, "/a", STATIC) == Chain(None, 2)


def test_a_chain_longer_than_the_worker_follows_counts_as_broken() -> None:
    redirects = {f"/p{index}": f"/p{index + 1}" for index in range(MAX_CHAIN + 1)}

    assert follow(redirects, "/p0", STATIC) == Chain(None, MAX_CHAIN)


def test_variants_are_grouped_sorted_and_annotated() -> None:
    entries = [
        entry("/a/b/c/", "http_404"),
        entry("/Stara/", "discovered"),
        entry("https://www.example.edu.pl/stara?p=1", "discovered"),
        entry("/kontakt"),
    ]
    evidence = Evidence(routes(), {}, frozenset({"/kontakt"}))

    findings = audit(entries, {"/stara": "/nowa"}, {}, evidence)

    assert findings == [
        Finding("/a/b/c", Category.MISSING, None, ("/a/b/c/",), ("old_site:http_404",)),
        Finding(
            "/stara",
            Category.MAPPED,
            "/nowa",
            ("/Stara/", "https://www.example.edu.pl/stara?p=1"),
            ("old_site:discovered", "query_ignored", "variants_collapsed", "target_not_in_sitemap"),
        ),
        Finding("/kontakt", Category.LIVE_SAME_PATH, None, ("/kontakt",), ()),
    ]
    assert audit(list(reversed(entries)), {"/stara": "/nowa"}, {}, evidence) == findings
