import json
from dataclasses import dataclass, field
from pathlib import Path

from zsm3_tools.archive_model import Authorization
from zsm3_tools.archive_paths import ArchivePathError, safe_relative

PERMISSIONS_VERSION = 1
MAX_PERMISSION_BYTES = 10_000_000
MAX_ALT_LENGTH = 300
ENTRY_KEYS = frozenset({"path", "status", "basis", "reference", "alt"})


class PermissionsError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Decision:
    status: Authorization
    basis: str | None = None
    reference: str | None = None
    alt: str | None = None


UNKNOWN = Decision(Authorization.UNKNOWN)


@dataclass(frozen=True, slots=True)
class Permissions:
    albums: dict[str, Decision] = field(default_factory=dict)
    photos: dict[str, Decision] = field(default_factory=dict)

    def for_album(self, album: str | None) -> Decision:
        return UNKNOWN if album is None else self.albums.get(album, UNKNOWN)

    def for_photo(self, path: str, album: str | None) -> Decision:
        own = self.photos.get(path)
        inherited = self.for_album(album)
        if own is None:
            return Decision(inherited.status, inherited.basis, inherited.reference)
        if inherited.status is Authorization.REJECTED:
            return Decision(Authorization.REJECTED, inherited.basis, inherited.reference, own.alt)
        if own.status is Authorization.UNKNOWN and own.alt is not None:
            return Decision(inherited.status, inherited.basis, inherited.reference, own.alt)
        return own


def _text(entry: dict[str, object], key: str) -> str | None:
    value = entry.get(key)
    if value is None:
        return None
    if not isinstance(value, str) or value.strip() == "":
        message = f"{key} must be a non-empty string"
        raise PermissionsError(message)
    return value.strip()


def _decision(entry: object) -> tuple[str, Decision]:
    if not isinstance(entry, dict) or set(entry) - ENTRY_KEYS or "path" not in entry:
        message = f"each entry needs a path and only {sorted(ENTRY_KEYS)}"
        raise PermissionsError(message)
    try:
        path = safe_relative(str(entry["path"]))
        status = Authorization(entry.get("status", "unknown"))
    except (ArchivePathError, ValueError) as error:
        raise PermissionsError(str(error)) from error
    basis, reference, alt = _text(entry, "basis"), _text(entry, "reference"), _text(entry, "alt")
    if status is Authorization.APPROVED and (basis is None or reference is None):
        message = f"{path}: approval needs a documented basis and a reference"
        raise PermissionsError(message)
    if alt is not None and len(alt) > MAX_ALT_LENGTH:
        message = f"{path}: alt text is longer than {MAX_ALT_LENGTH} characters"
        raise PermissionsError(message)
    return path, Decision(status, basis, reference, alt)


def _entries(document: dict[str, object], key: str) -> dict[str, Decision]:
    raw = document.get(key, [])
    if not isinstance(raw, list):
        message = f"{key} must be a list"
        raise PermissionsError(message)
    decided: dict[str, Decision] = {}
    for entry in raw:
        path, decision = _decision(entry)
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
    return Permissions(_entries(document, "albums"), _entries(document, "photos"))
