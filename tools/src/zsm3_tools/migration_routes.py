import re
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path, PurePosixPath

PAGE_SUFFIXES = (".astro", ".ts", ".md", ".mdx", ".html")
_PARAM = re.compile(r"^\[(\.\.\.)?[A-Za-z_][A-Za-z0-9_]*\]$")


class Segment(StrEnum):
    STATIC = "static"
    PARAM = "param"
    REST = "rest"


@dataclass(frozen=True, slots=True)
class Route:
    source: str
    parts: tuple[str, ...]
    kinds: tuple[Segment, ...]

    @property
    def is_static(self) -> bool:
        return all(kind is Segment.STATIC for kind in self.kinds)

    @property
    def path(self) -> str:
        return "/" + "/".join(self.parts)


class RouteMatch(StrEnum):
    STATIC = "static"
    DYNAMIC = "dynamic"
    NONE = "none"


def _segment_kind(part: str) -> Segment:
    match = _PARAM.fullmatch(part)
    if match is None:
        return Segment.STATIC
    return Segment.REST if match.group(1) else Segment.PARAM


def route_of(relative: PurePosixPath) -> Route | None:
    name = relative.name
    suffix = next((ending for ending in PAGE_SUFFIXES if name.endswith(ending)), None)
    if suffix is None or any(part.startswith("_") for part in relative.parts):
        return None
    stem = name.removesuffix(suffix)
    parts = [*relative.parts[:-1], *([] if stem == "index" else [stem])]
    return Route(relative.as_posix(), tuple(parts), tuple(_segment_kind(part) for part in parts))


def scan_routes(pages: Path) -> tuple[Route, ...]:
    routes = (
        route_of(PurePosixPath(file.relative_to(pages).as_posix()))
        for file in pages.rglob("*")
        if file.is_file()
    )
    found = tuple(sorted((route for route in routes if route is not None), key=lambda r: r.source))
    if not found:
        message = f"{pages}: no Astro pages found; pass the apps/web/src/pages directory"
        raise FileNotFoundError(message)
    return found


def _matches(route: Route, segments: tuple[str, ...]) -> bool:
    if route.kinds and route.kinds[-1] is Segment.REST:
        head = len(route.parts) - 1
        return len(segments) >= head and _matches_fixed(route, segments[:head], head)
    return len(segments) == len(route.parts) and _matches_fixed(route, segments, len(segments))


def _matches_fixed(route: Route, segments: tuple[str, ...], count: int) -> bool:
    return all(
        route.kinds[index] is not Segment.STATIC or route.parts[index] == segments[index]
        for index in range(count)
    )


def split_path(path: str) -> tuple[str, ...]:
    trimmed = path.strip("/")
    return () if trimmed == "" else tuple(trimmed.split("/"))


def matching(routes: tuple[Route, ...], path: str) -> tuple[Route, ...]:
    segments = split_path(path)
    return tuple(route for route in routes if _matches(route, segments))


def classify(routes: tuple[Route, ...], path: str) -> RouteMatch:
    candidates = matching(routes, path)
    if any(route.is_static for route in candidates):
        return RouteMatch.STATIC
    return RouteMatch.DYNAMIC if candidates else RouteMatch.NONE


def static_route(routes: tuple[Route, ...], path: str) -> Route | None:
    segments = split_path(path)
    return next((r for r in routes if r.is_static and r.parts == segments), None)
