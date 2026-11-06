import json
from dataclasses import dataclass, field, replace
from datetime import datetime
from pathlib import Path

from zsm3_tools.archive_model import Authorization, SourceAlbum
from zsm3_tools.archive_paths import ArchivePathError, safe_relative

PERMISSIONS_VERSION = 1
MAX_PERMISSION_BYTES = 10_000_000
MAX_ALT_LENGTH = 300
MAX_DESCRIPTION_LENGTH = 2000
ENTRY_KEYS = frozenset({"path", "status", "basis", "reference", "by", "at", "alt"})
ALBUM_DETAIL_KEYS = frozenset({"school_year", "title", "slug", "description"})


class PermissionsError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Decision:
    status: Authorization
    basis: str | None = None
    reference: str | None = None
    alt: str | None = None
    by: str | None = None
    at: str | None = None


@dataclass(frozen=True, slots=True)
class AlbumDetails:
    school_year: str | None = None
    title: str | None = None
    slug: str | None = None
    description: str | None = None


UNKNOWN = Decision(Authorization.UNKNOWN)


@dataclass(frozen=True, slots=True)
class Permissions:
    albums: dict[str, Decision] = field(default_factory=dict)
    photos: dict[str, Decision] = field(default_factory=dict)
    details: dict[str, AlbumDetails] = field(default_factory=dict)

    def album_with_details(self, album: SourceAlbum) -> SourceAlbum:
        given = self.details.get(album.path, AlbumDetails())
        return replace(
            album,
            school_year=given.school_year or album.school_year,
            title=given.title or album.title,
            slug=given.slug or album.slug,
            description=given.description or album.description,
        )

    def is_approved(self, path: str, album: str | None) -> bool:
        return self.for_photo(path, album).status is Authorization.APPROVED

    def for_album(self, album: str | None) -> Decision:
        return UNKNOWN if album is None else self.albums.get(album, UNKNOWN)

    def for_photo(self, path: str, album: str | None) -> Decision:
        own = self.photos.get(path)
        inherited = self.for_album(album)
        if own is None:
            return replace(inherited, alt=None)
        if inherited.status is Authorization.REJECTED:
            return replace(inherited, alt=own.alt)
        if own.status is Authorization.UNKNOWN and own.alt is not None:
            return replace(inherited, alt=own.alt)
        return own


def _text(entry: dict[str, object], key: str) -> str | None:
    value = entry.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or value.strip() == "":
        message = f"{key} must be a non-empty string"
        raise PermissionsError(message)
    return value.strip()


def _approval_problem(entry: dict[str, object]) -> str | None:
    fields = (_text(entry, key) for key in ("basis", "reference", "by", "at"))
    if any(value is None for value in fields):
        return "approval needs a documented basis, a reference, a person and a date"
    try:
        datetime.fromisoformat(str(entry["at"]))
    except ValueError:
        return "the approval date is not ISO 8601"
    return None


def _decision(entry: object, allowed: frozenset[str]) -> tuple[str, Decision]:
    if not isinstance(entry, dict) or set(entry) - allowed or "path" not in entry:
        message = f"each entry needs a path and only {sorted(allowed)}"
        raise PermissionsError(message)
    try:
        path = safe_relative(str(entry["path"]))
        status = Authorization(entry.get("status", "unknown"))
    except (ArchivePathError, ValueError) as error:
        raise PermissionsError(str(error)) from error
    problem = _approval_problem(entry) if status is Authorization.APPROVED else None
    if problem is not None:
        message = f"{path}: {problem}"
        raise PermissionsError(message)
    alt = _text(entry, "alt")
    if alt is not None and len(alt) > MAX_ALT_LENGTH:
        message = f"{path}: alt text is longer than {MAX_ALT_LENGTH} characters"
        raise PermissionsError(message)
    return path, Decision(
        status,
        _text(entry, "basis"),
        _text(entry, "reference"),
        alt,
        _text(entry, "by"),
        _text(entry, "at"),
    )


def _details(entry: object) -> AlbumDetails:
    fields: dict[str, object] = entry if isinstance(entry, dict) else {}
    description = _text(fields, "description")
    if description is not None and len(description) > MAX_DESCRIPTION_LENGTH:
        message = f"description is longer than {MAX_DESCRIPTION_LENGTH} characters"
        raise PermissionsError(message)
    return AlbumDetails(
        _text(fields, "school_year"), _text(fields, "title"), _text(fields, "slug"), description
    )


def _raw_entries(document: dict[str, object], key: str) -> list[object]:
    raw = document.get(key, [])
    if not isinstance(raw, list):
        message = f"{key} must be a list"
        raise PermissionsError(message)
    return raw


def _entries(raw: list[object], allowed: frozenset[str]) -> dict[str, Decision]:
    decided: dict[str, Decision] = {}
    for entry in raw:
        path, decision = _decision(entry, allowed)
        if path in decided:
            message = f"{path}: listed twice"
            raise PermissionsError(message)
        decided[path] = decision
    return decided


def load_permissions(path: Path | None) -> Permissions:
    if path is None:
        return Permissions()
    if path.stat().st_size > MAX_PERMISSION_BYTES:
        message = f"{path}: larger than {MAX_PERMISSION_BYTES} bytes"
        raise PermissionsError(message)
    try:
        document: object = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError) as error:
        message = f"{path}: not valid UTF-8 JSON"
        raise PermissionsError(message) from error
    if (
        not isinstance(document, dict)
        or document.get("version") != PERMISSIONS_VERSION
        or set(document) - {"version", "albums", "photos"}
    ):
        message = f"{path}: expected version {PERMISSIONS_VERSION} with albums and photos"
        raise PermissionsError(message)
    albums = _raw_entries(document, "albums")
    decided = _entries(albums, ENTRY_KEYS | ALBUM_DETAIL_KEYS)
    photos = _entries(_raw_entries(document, "photos"), ENTRY_KEYS)
    return Permissions(decided, photos, dict(zip(decided, map(_details, albums), strict=True)))
