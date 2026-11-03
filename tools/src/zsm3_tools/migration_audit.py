from collections.abc import Mapping, Sequence
from dataclasses import dataclass, field
from enum import StrEnum

from zsm3_tools.migration_paths import LegacyPath, is_document, is_redirectable, lookup_key_of
from zsm3_tools.migration_routes import Route, RouteMatch, classify

HTTP_OK = 200
MAX_CHAIN = 8


class Category(StrEnum):
    MAPPED_LOOP = "mapped_loop"
    MAPPED_TARGET_MISSING = "mapped_target_missing"
    MAPPED_UNENCODED = "mapped_unencoded"
    MAPPED_SHADOWED = "mapped_shadowed"
    MAPPED_CHAIN = "mapped_chain"
    MISSING = "missing"
    DOCUMENT_REVIEW = "document_review"
    NOT_REDIRECTABLE = "not_redirectable"
    UNRESOLVED = "unresolved"
    UNVERIFIED = "unverified"
    MAPPED_UNVERIFIED = "mapped_unverified"
    MAPPED = "mapped"
    LIVE_SAME_PATH = "live_same_path"


ORDER = {category: index for index, category in enumerate(Category)}


@dataclass(frozen=True, slots=True)
class LegacyEntry:
    source: str
    path: LegacyPath
    old_status: str = ""


@dataclass(frozen=True, slots=True)
class Evidence:
    routes: tuple[Route, ...]
    statuses: Mapping[str, int] = field(default_factory=dict)
    sitemap: frozenset[str] | None = None


@dataclass(frozen=True, slots=True)
class Finding:
    key: str
    category: Category
    target: str | None
    sources: tuple[str, ...]
    notes: tuple[str, ...]


@dataclass(frozen=True, slots=True)
class Chain:
    final: str | None
    hops: int


def exists(evidence: Evidence, path: str) -> RouteMatch:
    status = evidence.statuses.get(path)
    if status is not None:
        return RouteMatch.STATIC if status == HTTP_OK else RouteMatch.NONE
    return classify(evidence.routes, path)


def follow(redirects: Mapping[str, str], key: str, evidence: Evidence) -> Chain:
    seen = {key}
    current = redirects[key]
    for hop in range(1, MAX_CHAIN + 1):
        if current in seen:
            return Chain(None, hop)
        seen.add(current)
        following = redirects.get(current)
        if following is None or exists(evidence, current) is RouteMatch.STATIC:
            return Chain(current, hop)
        current = following
    return Chain(None, MAX_CHAIN)


def _mapped(
    redirects: Mapping[str, str], key: str, evidence: Evidence
) -> tuple[Category, str | None]:
    chain = follow(redirects, key, evidence)
    if chain.final is None:
        return Category.MAPPED_LOOP, None
    target = exists(evidence, chain.final)
    if target is RouteMatch.NONE:
        return Category.MAPPED_TARGET_MISSING, chain.final
    if chain.hops > 1:
        return Category.MAPPED_CHAIN, chain.final
    category = Category.MAPPED if target is RouteMatch.STATIC else Category.MAPPED_UNVERIFIED
    return category, chain.final


def categorise(
    path: LegacyPath,
    redirects: Mapping[str, str],
    unresolved: Mapping[str, str],
    evidence: Evidence,
    *,
    unencoded: Mapping[str, str] | None = None,
) -> tuple[Category, str | None]:
    if not is_redirectable(path.request_path):
        document = is_document(path.request_path)
        return (Category.DOCUMENT_REVIEW if document else Category.NOT_REDIRECTABLE), None
    live = exists(evidence, path.request_path)
    if path.lookup_key in redirects:
        if live is RouteMatch.STATIC:
            return Category.MAPPED_SHADOWED, redirects[path.lookup_key]
        return _mapped(redirects, path.lookup_key, evidence)
    return _unmapped(path.lookup_key, live, unresolved, unencoded or {})


def _unmapped(
    key: str, live: RouteMatch, unresolved: Mapping[str, str], unencoded: Mapping[str, str]
) -> tuple[Category, str | None]:
    if live is RouteMatch.STATIC:
        return Category.LIVE_SAME_PATH, None
    if key in unencoded:
        return Category.MAPPED_UNENCODED, unencoded[key]
    if key in unresolved:
        return Category.UNRESOLVED, unresolved[key]
    return (Category.UNVERIFIED if live is RouteMatch.DYNAMIC else Category.MISSING), None


def _notes(
    group: Sequence[LegacyEntry], finding: tuple[Category, str | None], evidence: Evidence
) -> list[str]:
    category, target = finding
    notes = sorted({f"old_site:{entry.old_status}" for entry in group if entry.old_status})
    if any(entry.path.had_query for entry in group):
        notes.append("query_ignored")
    if len({entry.path.request_path for entry in group}) > 1:
        notes.append("variants_collapsed")
    destination = None if category is Category.UNRESOLVED else target
    if (
        destination is not None
        and evidence.sitemap is not None
        and destination not in evidence.sitemap
    ):
        notes.append("target_not_in_sitemap")
    return notes


def unencoded_rows(redirects: Mapping[str, str]) -> dict[str, str]:
    return {
        lookup_key_of(key): target for key, target in redirects.items() if lookup_key_of(key) != key
    }


def audit(
    entries: Sequence[LegacyEntry],
    redirects: Mapping[str, str],
    unresolved: Mapping[str, str],
    evidence: Evidence,
) -> list[Finding]:
    grouped: dict[str, list[LegacyEntry]] = {}
    for entry in entries:
        grouped.setdefault(entry.path.lookup_key, []).append(entry)
    findings: list[Finding] = []
    unencoded = unencoded_rows(redirects)
    for key, group in grouped.items():
        path = group[0].path
        category, target = categorise(path, redirects, unresolved, evidence, unencoded=unencoded)
        sources = tuple(sorted({entry.source for entry in group}))
        notes = tuple(_notes(group, (category, target), evidence))
        findings.append(Finding(key, category, target, sources, notes))
    return sorted(findings, key=lambda finding: (ORDER[finding.category], finding.key))
