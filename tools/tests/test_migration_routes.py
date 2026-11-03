from pathlib import Path, PurePosixPath

import pytest

from zsm3_tools.migration_cms import CmsCategory, CmsFinding, cms_findings
from zsm3_tools.migration_routes import (
    RouteMatch,
    Segment,
    classify,
    matching,
    route_of,
    scan_routes,
    split_path,
    static_route,
)

PAGES = Path(__file__).resolve().parents[2] / "apps" / "web" / "src" / "pages"


def write_pages(root: Path, names: list[str]) -> Path:
    for name in names:
        file = root / name
        file.parent.mkdir(parents=True, exist_ok=True)
        file.write_text("", encoding="utf-8")
    return root


@pytest.mark.parametrize(
    ("name", "path", "kinds"),
    [
        ("index.astro", "/", ()),
        ("kontakt.astro", "/kontakt", (Segment.STATIC,)),
        ("szkola/index.astro", "/szkola", (Segment.STATIC,)),
        ("sitemap.xml.ts", "/sitemap.xml", (Segment.STATIC,)),
        ("[section]/[page].astro", "/[section]/[page]", (Segment.PARAM, Segment.PARAM)),
        ("wzornik/[...rest].astro", "/wzornik/[...rest]", (Segment.STATIC, Segment.REST)),
    ],
)
def test_a_page_file_becomes_a_route(name: str, path: str, kinds: tuple[Segment, ...]) -> None:
    route = route_of(PurePosixPath(name))

    assert route is not None
    assert route.path == path
    assert route.kinds == kinds
    assert route.is_static is all(kind is Segment.STATIC for kind in kinds)


@pytest.mark.parametrize("name", ["styles.css", "_partial.astro", "_parts/card.astro"])
def test_files_astro_does_not_route_are_ignored(name: str) -> None:
    assert route_of(PurePosixPath(name)) is None


def test_static_routes_win_and_rest_routes_take_any_depth(tmp_path: Path) -> None:
    pages = write_pages(
        tmp_path,
        ["kontakt.astro", "[section]/index.astro", "[section]/[page].astro", "w/[...rest].astro"],
    )
    routes = scan_routes(pages)
    write_pages(tmp_path, ["notes.txt"])

    assert [route.source for route in scan_routes(pages)] == [route.source for route in routes]
    assert classify(routes, "/kontakt") is RouteMatch.STATIC
    assert classify(routes, "/kontakt/") is RouteMatch.STATIC
    assert classify(routes, "/szkola") is RouteMatch.DYNAMIC
    assert classify(routes, "/szkola/historia") is RouteMatch.DYNAMIC
    assert classify(routes, "/a/b/c") is RouteMatch.NONE
    assert classify(routes, "/w") is RouteMatch.DYNAMIC
    assert classify(routes, "/w/x/y/z") is RouteMatch.DYNAMIC
    assert classify(routes, "/") is RouteMatch.NONE
    assert [route.source for route in matching(routes, "/szkola")] == ["[section]/index.astro"]
    assert static_route(routes, "/kontakt") is not None
    assert static_route(routes, "/szkola") is None
    assert split_path("/") == ()


def test_cms_pages_behind_static_routes_hubs_or_no_route_are_reported(tmp_path: Path) -> None:
    routes = scan_routes(
        write_pages(tmp_path, ["kontakt.astro", "[section]/index.astro", "[section]/[page].astro"])
    )

    assert cms_findings(
        routes, ["/szkola/historia", "/kontakt", "/rodo", "/a/b/c", "/kontakt"]
    ) == [
        CmsFinding("/a/b/c", CmsCategory.UNROUTABLE, ""),
        CmsFinding("/kontakt", CmsCategory.SHADOWED, "kontakt.astro"),
        CmsFinding("/rodo", CmsCategory.SECTION_LEVEL, "[section]/index.astro"),
    ]


def test_the_site_shadows_the_pages_found_in_the_indexnow_review() -> None:
    routes = scan_routes(PAGES)
    known = [
        "/kontakt",
        "/polityka-prywatnosci",
        "/szkola/kadra",
        "/szkola/terminarz",
        "/rodzice/wywiadowki",
        "/uczniowie/wzory-dokumentow",
        "/kandydaci/zawody",
        "/aktualnosci",
    ]

    assert {finding.path for finding in cms_findings(routes, known)} == set(known)
    assert all(finding.category is CmsCategory.SHADOWED for finding in cms_findings(routes, known))
    assert classify(routes, "/szkola/historia") is RouteMatch.DYNAMIC
