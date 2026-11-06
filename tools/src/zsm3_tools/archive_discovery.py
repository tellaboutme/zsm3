import os
import re
import unicodedata
from dataclasses import dataclass, field
from pathlib import Path

from zsm3_tools.archive_model import Ignored, Inventory, Settings, SourceAlbum, SourcePhoto
from zsm3_tools.archive_paths import relative_posix

IMAGE_EXTENSIONS = frozenset(
    {"jpg", "jpeg", "png", "webp", "gif", "bmp", "tif", "tiff", "heic", "heif"}
)
ARCHIVE_EXTENSIONS = frozenset({"zip", "rar", "7z", "tar", "gz", "tgz"})
SYSTEM_FILES = frozenset({"thumbs.db", "desktop.ini"})
MAX_SLUG_LENGTH = 120
MAX_TITLE_LENGTH = 200
POLISH = str.maketrans("ąćęłńóśźżĄĆĘŁŃÓŚŹŻ", "acelnoszzACELNOSZZ")

_YEAR_PAIR = re.compile(r"^(\d{4})\s*[-_.\s]\s*(\d{4}|\d{2})(?!\d)[\s_-]*(.*)$")


class DiscoveryError(ValueError):
    pass


@dataclass(slots=True)
class _Walk:
    root: Path
    settings: Settings
    photos: list[SourcePhoto] = field(default_factory=list)
    ignored: list[Ignored] = field(default_factory=list)
    albums: set[str] = field(default_factory=set)


def school_year(name: str) -> tuple[str | None, str]:
    match = _YEAR_PAIR.match(name)
    if match is None:
        return None, name
    first, second, rest = int(match.group(1)), match.group(2), match.group(3)
    following = first + 1
    expected = str(following) if len(second) == len("2020") else f"{following % 100:02d}"
    if second != expected:
        return None, name
    return f"{first}/{following}", rest


def slug_of(title: str) -> str | None:
    folded = unicodedata.normalize("NFKD", title.translate(POLISH))
    ascii_only = folded.encode("ascii", "ignore").decode().lower()
    slug = re.sub(r"[^a-z0-9]+", "-", ascii_only).strip("-")
    if len(slug) > MAX_SLUG_LENGTH:
        slug = slug[:MAX_SLUG_LENGTH].rsplit("-", 1)[0]
    return slug or None


def describe_album(path: str) -> SourceAlbum:
    parts = path.split("/")
    year: str | None = None
    for part in parts[:-1]:
        year = year or school_year(part)[0]
    own_year, remainder = school_year(parts[-1])
    title = re.sub(r"[\s_]+", " ", remainder).strip(" -") or None
    if title is not None:
        title = title[:MAX_TITLE_LENGTH]
    return SourceAlbum(path, own_year or year, title, None if title is None else slug_of(title))


def _classify(walk: _Walk, entry: os.DirEntry[str], relative: str) -> None:
    name = entry.name
    extension = name.rsplit(".", 1)[-1].lower() if "." in name else ""
    if name.lower() in SYSTEM_FILES:
        walk.ignored.append(Ignored(relative, "system_file"))
    elif extension in ARCHIVE_EXTENSIONS:
        walk.ignored.append(Ignored(relative, "archive_not_supported"))
    elif extension not in IMAGE_EXTENSIONS:
        walk.ignored.append(Ignored(relative, "not_an_image"))
    else:
        album = relative.rsplit("/", 1)[0] if "/" in relative else None
        if album is not None:
            walk.albums.add(album)
        walk.photos.append(SourcePhoto(relative, album, extension, entry.stat().st_size))
        if len(walk.photos) > walk.settings.max_files:
            message = f"more than {walk.settings.max_files} photos; raise --max-files"
            raise DiscoveryError(message)


def _visit(walk: _Walk, directory: Path, depth: int) -> list[tuple[Path, int]]:
    deeper: list[tuple[Path, int]] = []
    with os.scandir(directory) as found:
        entries = sorted(found, key=lambda item: item.name)
    if not entries and directory != walk.root:
        walk.ignored.append(Ignored(relative_posix(directory, walk.root), "empty_directory"))
    for entry in entries:
        path = Path(entry.path)
        relative = relative_posix(path, walk.root)
        if entry.name.startswith("."):
            walk.ignored.append(Ignored(relative, "hidden"))
        elif entry.is_symlink() or entry.is_junction():
            walk.ignored.append(Ignored(relative, "link_not_followed"))
        elif entry.is_dir(follow_symlinks=False):
            if depth >= walk.settings.max_depth:
                walk.ignored.append(Ignored(relative, "too_deep"))
            else:
                deeper.append((path, depth + 1))
        elif entry.is_file(follow_symlinks=False):
            _classify(walk, entry, relative)
        else:
            walk.ignored.append(Ignored(relative, "not_a_regular_file"))
    return deeper


def discover(root: Path, settings: Settings) -> Inventory:
    walk = _Walk(root, settings)
    pending = [(root, 0)]
    while pending:
        directory, depth = pending.pop()
        pending.extend(reversed(_visit(walk, directory, depth)))
    albums = tuple(describe_album(path) for path in sorted(walk.albums))
    photos = tuple(sorted(walk.photos, key=lambda photo: photo.path))
    ignored = tuple(sorted(walk.ignored, key=lambda item: item.path))
    return Inventory(albums, photos, ignored)
