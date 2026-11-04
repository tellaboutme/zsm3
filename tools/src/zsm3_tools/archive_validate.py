import hashlib
import re
from collections import Counter
from pathlib import Path

from zsm3_tools.archive_model import (
    LARGE_LONG_EDGE,
    MAX_ALBUM_PHOTOS,
    MAX_VARIANT_BYTES,
    SCHEMA_VERSION,
    SMALL_LONG_EDGE,
    Outcome,
    planned_key,
)
from zsm3_tools.archive_webp import is_plain_webp

Json = dict[str, object]

_SHA = re.compile(r"^[0-9a-f]{64}$")
_SLUG = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")
_YEAR = re.compile(r"^(\d{4})/(\d{4})$")
MAX_SLUG = 120
MAX_TITLE = 200
MAX_ALT = 300


def _dimensions(value: object) -> tuple[int, int, int] | None:
    if not isinstance(value, dict):
        return None
    width, height, size = value.get("width"), value.get("height"), value.get("size_bytes")
    if not all(isinstance(item, int) for item in (width, height, size)):
        return None
    return int(str(width)), int(str(height)), int(str(size))


def _variant_problems(photo: Json) -> list[str]:
    large, small = _dimensions(photo.get("large")), _dimensions(photo.get("small"))
    if large is None or small is None:
        return ["variant sizes missing"]
    problems: list[str] = []
    edge = max(large[:2])
    if not SMALL_LONG_EDGE <= edge <= LARGE_LONG_EDGE or min(large[:2]) < 1:
        problems.append("large long edge outside 400-1600")
    if max(small[:2]) != SMALL_LONG_EDGE:
        problems.append("small long edge is not 400")
    scale = SMALL_LONG_EDGE / edge if edge else 0
    if any(
        abs(s - round(value * scale)) > 1 for s, value in zip(small[:2], large[:2], strict=True)
    ):
        problems.append("small variant does not match the large aspect ratio")
    if max(large[2], small[2]) > MAX_VARIANT_BYTES:
        problems.append("variant larger than 1.5 MB")
    return problems


def photo_problems(photo: Json) -> list[str]:
    sha = photo.get("large_sha256")
    if not isinstance(sha, str) or _SHA.fullmatch(sha) is None:
        return ["large_sha256 is not a lowercase SHA-256"]
    problems = _variant_problems(photo)
    expected = {"large": planned_key(sha, "l"), "small": planned_key(sha, "s")}
    if photo.get("planned_keys") != expected:
        problems.append("planned R2 keys do not follow g/<sha256>-(l|s).webp")
    alt = photo.get("alt")
    if not isinstance(alt, str) or not 1 <= len(alt.strip()) <= MAX_ALT:
        problems.append("alt text must be 1-300 characters")
    if photo.get("authorization") != "approved":
        problems.append("eligible without approval")
    return problems


def album_problems(album: Json) -> list[str]:
    problems: list[str] = []
    year = _YEAR.fullmatch(str(album.get("school_year")))
    if year is None or int(year.group(2)) != int(year.group(1)) + 1:
        problems.append("school year must be YYYY/YYYY+1")
    slug = album.get("slug_candidate")
    if not isinstance(slug, str) or len(slug) > MAX_SLUG or _SLUG.fullmatch(slug) is None:
        problems.append("slug does not match the gallery contract")
    title = album.get("title_candidate")
    if not isinstance(title, str) or not 1 <= len(title.strip()) <= MAX_TITLE:
        problems.append("title must be 1-200 characters")
    eligible = album.get("eligible_count")
    if not isinstance(eligible, int) or eligible > MAX_ALBUM_PHOTOS:
        problems.append("more than 1000 photos in one album")
    return problems


def _file_problems(photo: Json, variants: Path) -> list[str]:
    sha = str(photo["large_sha256"])
    large, small = variants / f"{sha}-l.webp", variants / f"{sha}-s.webp"
    if not large.is_file() or not small.is_file():
        return ["variant file missing"]
    data = large.read_bytes()
    problems: list[str] = []
    if hashlib.sha256(data).hexdigest() != sha:
        problems.append("large variant hash differs")
    if not (is_plain_webp(data) and is_plain_webp(small.read_bytes())):
        problems.append("variant is not a plain WebP")
    return problems


def _list(manifest: Json, key: str) -> list[Json]:
    value = manifest.get(key)
    if not isinstance(value, list):
        return []
    return [item for item in value if isinstance(item, dict)]


def validate(manifest: Json, variants: Path | None = None) -> list[str]:
    if manifest.get("schema_version") != SCHEMA_VERSION or manifest.get("dry_run") is not True:
        return [f"not a dry-run manifest of schema {SCHEMA_VERSION}"]
    photos = [p for p in _list(manifest, "photos") if p.get("outcome") == Outcome.ELIGIBLE.value]
    used = {str(p.get("album_path")) for p in photos}
    problems: list[str] = []
    for album in _list(manifest, "albums"):
        if album.get("album_path") in used:
            path = album.get("album_path")
            problems += [f"album {path}: {problem}" for problem in album_problems(album)]
    slugs = Counter(
        (a.get("school_year"), a.get("slug_candidate"))
        for a in _list(manifest, "albums")
        if a.get("album_path") in used
    )
    problems += [
        f"album slug {slug} repeats in {year}" for (year, slug), n in slugs.items() if n > 1
    ]
    hashes = Counter(p.get("large_sha256") for p in photos)
    problems += [f"photo hash {sha} repeats" for sha, n in hashes.items() if n > 1]
    for photo in photos:
        found = photo_problems(photo)
        if variants is not None and not found:
            found = _file_problems(photo, variants)
        problems += [f"photo {photo.get('source_id')}: {problem}" for problem in found]
    return sorted(problems)
