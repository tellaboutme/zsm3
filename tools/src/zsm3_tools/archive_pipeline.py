import hashlib
from collections.abc import Callable
from dataclasses import dataclass
from pathlib import Path

from zsm3_tools.archive_images import Encoded, convert
from zsm3_tools.archive_model import Conversion, Inventory, Settings, SourcePhoto, source_id
from zsm3_tools.archive_store import Store

HASH_CHUNK_BYTES = 1 << 20

Progress = Callable[[int, int], None]
Converter = Callable[[bytes, Settings], Encoded]
MayConvert = Callable[[SourcePhoto], bool]


@dataclass(frozen=True, slots=True)
class PhotoResult:
    photo: SourcePhoto
    identifier: str
    conversion: Conversion
    reused: bool


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        while chunk := handle.read(HASH_CHUNK_BYTES):
            digest.update(chunk)
    return digest.hexdigest()


def _refused(sha: str, reason: str) -> Encoded:
    return Encoded(Conversion(sha, None, reason, None, None, None), b"", b"")


def _encode(file: Path, sha: str, settings: Settings, converter: Converter) -> Encoded:
    if file.stat().st_size > settings.max_source_bytes:
        return _refused(sha, "source_too_large")
    data = file.read_bytes()
    if hashlib.sha256(data).hexdigest() != sha:
        return _refused(sha, "changed_during_run")
    return converter(data, settings)


def _any_photo(_: SourcePhoto) -> bool:
    return True


@dataclass(frozen=True, slots=True)
class Steps:
    converter: Converter = convert
    may_convert: MayConvert = _any_photo


DEFAULT_STEPS = Steps()


def _one(
    source: Path,
    photo: SourcePhoto,
    store: Store,
    converter: Converter,
    may_convert: MayConvert,
) -> PhotoResult:
    identifier = source_id(photo.path)
    file = source.joinpath(*photo.path.split("/"))
    if file.is_symlink() or not file.is_file():
        reason = "link_not_followed" if file.is_symlink() else "missing_source"
        return PhotoResult(photo, identifier, _refused("", reason).conversion, reused=False)
    sha = file_sha256(file)
    if not may_convert(photo):
        store.discard(identifier)
        skipped = Conversion(sha, None, None, None, None, None)
        return PhotoResult(photo, identifier, skipped, reused=False)
    cached = store.load(identifier, sha)
    if cached is not None:
        return PhotoResult(photo, identifier, cached, reused=True)
    encoded = _encode(file, sha, store.settings, converter)
    store.save(identifier, encoded)
    return PhotoResult(photo, identifier, encoded.conversion, reused=False)


def process(
    source: Path,
    inventory: Inventory,
    store: Store,
    progress: Progress,
    steps: Steps = DEFAULT_STEPS,
) -> list[PhotoResult]:
    results: list[PhotoResult] = []
    total = len(inventory.photos)
    for index, photo in enumerate(inventory.photos, start=1):
        results.append(_one(source, photo, store, steps.converter, steps.may_convert))
        progress(index, total)
    return results
