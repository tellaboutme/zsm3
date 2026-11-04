import hashlib
from dataclasses import dataclass
from enum import StrEnum

SCHEMA_VERSION = 1
PROCESSING_VERSION = "gallery-archive/1"
LARGE_LONG_EDGE = 1600
SMALL_LONG_EDGE = 400
MAX_VARIANT_BYTES = 1_500_000
MAX_ALBUM_PHOTOS = 1000


class Authorization(StrEnum):
    UNKNOWN = "unknown"
    APPROVED = "approved"
    REJECTED = "rejected"


class Outcome(StrEnum):
    INVALID = "invalid"
    DUPLICATE = "duplicate"
    REJECTED = "rejected"
    MISSING_PERMISSION = "missing_permission"
    INCOMPLETE = "incomplete"
    ELIGIBLE = "eligible"


@dataclass(frozen=True, slots=True)
class Settings:
    quality: int = 82
    max_pixels: int = 80_000_000
    max_source_bytes: int = 50_000_000
    max_files: int = 20_000
    max_depth: int = 6

    def key(self) -> str:
        return f"{PROCESSING_VERSION};q={self.quality};px={self.max_pixels}"


@dataclass(frozen=True, slots=True)
class SourceAlbum:
    path: str
    school_year: str | None
    title: str | None
    slug: str | None


@dataclass(frozen=True, slots=True)
class SourcePhoto:
    path: str
    album: str | None
    extension: str
    size_bytes: int


@dataclass(frozen=True, slots=True)
class Ignored:
    path: str
    reason: str


@dataclass(frozen=True, slots=True)
class Inventory:
    albums: tuple[SourceAlbum, ...]
    photos: tuple[SourcePhoto, ...]
    ignored: tuple[Ignored, ...]


@dataclass(frozen=True, slots=True)
class Variant:
    width: int
    height: int
    size_bytes: int


@dataclass(frozen=True, slots=True)
class Conversion:
    source_sha256: str
    source_format: str | None
    error: str | None
    large: Variant | None
    small: Variant | None
    large_sha256: str | None


def source_id(path: str) -> str:
    return hashlib.sha256(f"zsm3-gallery-source\0{path}".encode()).hexdigest()[:32]


def planned_key(sha256: str, variant: str) -> str:
    return f"g/{sha256}-{variant}.webp"
