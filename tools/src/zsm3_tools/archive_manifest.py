import json
from collections import Counter
from dataclasses import asdict

from PIL import __version__ as pillow_version

from zsm3_tools.archive_images import WEBP_METHOD
from zsm3_tools.archive_model import (
    LARGE_LONG_EDGE,
    MAX_ALBUM_PHOTOS,
    MAX_VARIANT_BYTES,
    PROCESSING_VERSION,
    SCHEMA_VERSION,
    SMALL_LONG_EDGE,
    Authorization,
    Inventory,
    Outcome,
    Settings,
    SourceAlbum,
    planned_key,
)
from zsm3_tools.archive_permissions import Decision, Permissions
from zsm3_tools.archive_pipeline import PhotoResult

Json = dict[str, object]


def _duplicates(results: list[PhotoResult]) -> dict[str, str]:
    first: dict[str, str] = {}
    duplicate_of: dict[str, str] = {}
    for result in results:
        conversion = result.conversion
        keys = [f"source:{conversion.source_sha256}"] if conversion.source_sha256 else []
        if conversion.large_sha256 is not None:
            keys.append(f"large:{conversion.large_sha256}")
        primary = next((first[key] for key in keys if key in first), None)
        if primary is not None:
            duplicate_of[result.identifier] = primary
            continue
        for key in keys:
            first[key] = result.identifier
    return duplicate_of


def album_issues(album: SourceAlbum | None) -> list[str]:
    if album is None:
        return ["no_album"]
    issues = [
        name
        for name, value in (
            ("missing_school_year", album.school_year),
            ("missing_title", album.title),
            ("missing_slug", album.slug),
        )
        if value is None
    ]
    return sorted(issues)


def _outcome(
    result: PhotoResult, decision: Decision, issues: list[str]
) -> tuple[Outcome, list[str]]:
    error = result.conversion.error
    if error is not None:
        return Outcome.INVALID, [error]
    if decision.status is Authorization.REJECTED:
        return Outcome.REJECTED, []
    if decision.status is Authorization.UNKNOWN:
        return Outcome.MISSING_PERMISSION, []
    reasons = issues + ([] if decision.alt is not None else ["missing_alt"])
    return (Outcome.INCOMPLETE, sorted(reasons)) if reasons else (Outcome.ELIGIBLE, [])


def _photo(result: PhotoResult, decision: Decision, outcome: tuple[Outcome, list[str]]) -> Json:
    conversion = result.conversion
    sha = conversion.large_sha256
    return {
        "source_id": result.identifier,
        "source_path": result.photo.path,
        "source_url": None,
        "album_path": result.photo.album,
        "extension": result.photo.extension,
        "source_bytes": result.photo.size_bytes,
        "source_sha256": conversion.source_sha256 or None,
        "source_format": conversion.source_format,
        "conversion": "failed" if conversion.error else "converted",
        "large": None if conversion.large is None else asdict(conversion.large),
        "small": None if conversion.small is None else asdict(conversion.small),
        "large_sha256": sha,
        "planned_keys": None
        if sha is None
        else {"large": planned_key(sha, "l"), "small": planned_key(sha, "s")},
        "duplicate_of": None,
        "authorization": decision.status.value,
        "authorization_basis": decision.basis,
        "authorization_reference": decision.reference,
        "alt": decision.alt,
        "outcome": outcome[0].value,
        "reasons": outcome[1],
    }


def _photos(
    results: list[PhotoResult], permissions: Permissions, albums: dict[str, SourceAlbum]
) -> list[Json]:
    duplicates = _duplicates(results)
    eligible_per_album: Counter[str] = Counter()
    rows: list[Json] = []
    for result in results:
        album = result.photo.album
        decision = permissions.for_photo(result.photo.path, album)
        outcome = _outcome(result, decision, album_issues(albums.get(album or "")))
        if result.identifier in duplicates and outcome[0] is not Outcome.INVALID:
            outcome = (Outcome.DUPLICATE, ["same_photo"])
        if outcome[0] is Outcome.ELIGIBLE and album is not None:
            eligible_per_album[album] += 1
            if eligible_per_album[album] > MAX_ALBUM_PHOTOS:
                outcome = (Outcome.INCOMPLETE, ["album_full"])
        row = _photo(result, decision, outcome)
        row["duplicate_of"] = duplicates.get(result.identifier)
        rows.append(row)
    return rows


def _album(album: SourceAlbum, permissions: Permissions, photos: list[Json]) -> Json:
    own = [photo for photo in photos if photo["album_path"] == album.path]
    return {
        "album_path": album.path,
        "school_year": album.school_year,
        "title_candidate": album.title,
        "slug_candidate": album.slug,
        "authorization": permissions.for_album(album.path).status.value,
        "photo_count": len(own),
        "eligible_count": sum(photo["outcome"] == Outcome.ELIGIBLE.value for photo in own),
        "issues": album_issues(album),
    }


def build(
    inventory: Inventory,
    results: list[PhotoResult],
    permissions: Permissions,
    settings: Settings,
    label: str,
) -> Json:
    albums = {album.path: album for album in inventory.albums}
    photos = _photos(results, permissions, albums)
    outcomes = Counter(str(photo["outcome"]) for photo in photos)
    return {
        "schema_version": SCHEMA_VERSION,
        "dry_run": True,
        "processing": {
            "version": PROCESSING_VERSION,
            "pillow": pillow_version,
            "webp_quality": settings.quality,
            "webp_method": WEBP_METHOD,
            "large_long_edge": LARGE_LONG_EDGE,
            "small_long_edge": SMALL_LONG_EDGE,
            "max_variant_bytes": MAX_VARIANT_BYTES,
        },
        "source": {"kind": "local_directory", "label": label},
        "summary": {
            "albums": len(inventory.albums),
            "photos": len(photos),
            "ignored": len(inventory.ignored),
            "outcomes": {outcome.value: outcomes[outcome.value] for outcome in Outcome},
        },
        "albums": [_album(album, permissions, photos) for album in inventory.albums],
        "photos": photos,
        "ignored": [asdict(item) for item in inventory.ignored],
    }


def serialise(manifest: Json) -> bytes:
    return (json.dumps(manifest, ensure_ascii=False, indent=2, sort_keys=True) + "\n").encode()
