import csv
import json
from dataclasses import dataclass
from pathlib import Path

from zsm3_tools.migration_audit import LegacyEntry
from zsm3_tools.migration_paths import LegacyPathError, legacy_path
from zsm3_tools.redirect_paths import RedirectRowError, normalise_from_path, parse_redirect_row
from zsm3_tools.redirect_sources import SourceError, read_csv, read_sitemap

UNRESOLVED_HEADER = ("from_path", "previous_to_path", "reason")
MAX_INPUT_BYTES = 20_000_000


class InputError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Rejected:
    origin: str
    value: str
    reason: str


@dataclass(frozen=True, slots=True)
class Loaded[T]:
    items: T
    rejected: tuple[Rejected, ...]


def _text(path: Path) -> str:
    try:
        if path.stat().st_size > MAX_INPUT_BYTES:
            message = f"{path}: larger than {MAX_INPUT_BYTES} bytes"
            raise InputError(message)
        return path.read_text(encoding="utf-8-sig")
    except (OSError, UnicodeDecodeError) as error:
        message = f"{path}: unreadable: {error}"
        raise InputError(message) from error


def _entry(origin: str, raw: str, status: str, rejected: list[Rejected]) -> LegacyEntry | None:
    try:
        return LegacyEntry(raw, legacy_path(raw), status)
    except LegacyPathError as error:
        rejected.append(Rejected(origin, raw, str(error)))
        return None


def read_inventory(path: Path) -> Loaded[list[LegacyEntry]]:
    try:
        payload: object = json.loads(_text(path))
    except json.JSONDecodeError as error:
        message = f"{path}: invalid JSON: {error}"
        raise InputError(message) from error
    if not isinstance(payload, list):
        message = f"{path}: expected a JSON array of inventory entries"
        raise InputError(message)
    entries: list[LegacyEntry] = []
    rejected: list[Rejected] = []
    for position, item in enumerate(payload, start=1):
        origin = f"{path}#{position}"
        url = item.get("url") if isinstance(item, dict) else None
        status = item.get("status") if isinstance(item, dict) else None
        if not isinstance(url, str) or not isinstance(status, str):
            rejected.append(Rejected(origin, "", "entry needs string url and status"))
            continue
        entry = _entry(origin, url, status, rejected)
        if entry is not None:
            entries.append(entry)
    return Loaded(entries, tuple(rejected))


def read_url_list(path: Path) -> Loaded[list[LegacyEntry]]:
    entries: list[LegacyEntry] = []
    rejected: list[Rejected] = []
    for number, line in enumerate(_text(path).splitlines(), start=1):
        value = line.strip()
        if value == "" or value.startswith("#"):
            continue
        entry = _entry(f"{path}:{number}", value, "", rejected)
        if entry is not None:
            entries.append(entry)
    return Loaded(entries, tuple(rejected))


def read_map(path: Path) -> Loaded[dict[str, str]]:
    try:
        rows = read_csv(path)
    except SourceError as error:
        raise InputError(str(error)) from error
    mapped: dict[str, str] = {}
    rejected: list[Rejected] = []
    for row in rows:
        try:
            parsed = parse_redirect_row(row.raw_from, row.raw_to)
        except RedirectRowError as error:
            rejected.append(Rejected(row.origin, row.raw_from, str(error)))
            continue
        if parsed.from_path in mapped:
            rejected.append(Rejected(row.origin, row.raw_from, "duplicate once normalised"))
            continue
        mapped[parsed.from_path] = parsed.to_path
    return Loaded(mapped, tuple(rejected))


def read_unresolved(path: Path) -> dict[str, str]:
    rows = list(csv.reader(_text(path).splitlines()))
    if not rows or tuple(rows[0]) != UNRESOLVED_HEADER:
        message = f"{path}: first row must be {','.join(UNRESOLVED_HEADER)}"
        raise InputError(message)
    if any(len(row) != len(UNRESOLVED_HEADER) for row in rows[1:] if row):
        message = f"{path}: every row must have exactly {len(UNRESOLVED_HEADER)} columns"
        raise InputError(message)
    return {normalise_from_path(row[0]): row[2] for row in rows[1:] if row}


def read_paths(path: Path) -> frozenset[str]:
    lines = (line.strip() for line in _text(path).splitlines())
    return frozenset(line for line in lines if line.startswith("/"))


def read_sitemap_paths(path: Path) -> frozenset[str]:
    try:
        rows = read_sitemap(path, "/")
    except SourceError as error:
        raise InputError(str(error)) from error
    return frozenset(row.raw_from for row in rows)
