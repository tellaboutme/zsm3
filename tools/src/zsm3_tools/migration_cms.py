from collections.abc import Iterable
from dataclasses import dataclass
from enum import StrEnum

from zsm3_tools.migration_routes import Route, matching, split_path, static_route


class CmsCategory(StrEnum):
    SHADOWED = "cms_shadowed"
    UNROUTABLE = "cms_unroutable"
    SECTION_LEVEL = "cms_section_level"


@dataclass(frozen=True, slots=True)
class CmsFinding:
    path: str
    category: CmsCategory
    route: str


def cms_finding(routes: tuple[Route, ...], path: str) -> CmsFinding | None:
    shadow = static_route(routes, path)
    if shadow is not None:
        return CmsFinding(path, CmsCategory.SHADOWED, shadow.source)
    candidates = matching(routes, path)
    if not candidates:
        return CmsFinding(path, CmsCategory.UNROUTABLE, "")
    if len(split_path(path)) == 1:
        return CmsFinding(path, CmsCategory.SECTION_LEVEL, candidates[0].source)
    return None


def cms_findings(routes: tuple[Route, ...], paths: Iterable[str]) -> list[CmsFinding]:
    found = (cms_finding(routes, path) for path in sorted(set(paths)))
    return [finding for finding in found if finding is not None]
