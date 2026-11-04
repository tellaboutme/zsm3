import hashlib
import json
from dataclasses import asdict
from pathlib import Path

from zsm3_tools.archive_images import Encoded
from zsm3_tools.archive_model import Conversion, Settings, Variant
from zsm3_tools.archive_paths import RUN_MARKER, remove_partials, write_atomic
from zsm3_tools.archive_webp import is_plain_webp

RECORD_VERSION = 1


class Store:
    def __init__(self, root: Path, settings: Settings) -> None:
        self.root = root
        self.records = root / "records"
        self.variants = root / "variants"
        self.settings = settings

    def prepare(self) -> int:
        for directory in (self.root, self.records, self.variants):
            directory.mkdir(parents=True, exist_ok=True)
        (self.root / RUN_MARKER).write_text(self.settings.key() + "\n", encoding="utf-8")
        return remove_partials(self.records) + remove_partials(self.variants)

    def variant_path(self, sha256: str, variant: str) -> Path:
        return self.variants / f"{sha256}-{variant}.webp"

    def _record_path(self, identifier: str) -> Path:
        return self.records / f"{identifier}.json"

    def save(self, identifier: str, encoded: Encoded) -> None:
        conversion = encoded.conversion
        if conversion.large_sha256 is not None:
            write_atomic(self.variant_path(conversion.large_sha256, "l"), encoded.large)
            write_atomic(self.variant_path(conversion.large_sha256, "s"), encoded.small)
        record = {
            "version": RECORD_VERSION,
            "settings": self.settings.key(),
            "conversion": asdict(conversion),
        }
        data = json.dumps(record, sort_keys=True).encode() + b"\n"
        write_atomic(self._record_path(identifier), data)

    def load(self, identifier: str, source_sha256: str) -> Conversion | None:
        path = self._record_path(identifier)
        try:
            record = json.loads(path.read_text(encoding="utf-8"))
            conversion = _conversion(record["conversion"])
            current = record["version"] == RECORD_VERSION and (
                record["settings"] == self.settings.key()
            )
        except (OSError, ValueError, KeyError, TypeError):
            return None
        if not current or conversion.source_sha256 != source_sha256:
            return None
        return conversion if self._variants_intact(conversion) else None

    def _variants_intact(self, conversion: Conversion) -> bool:
        sha = conversion.large_sha256
        if sha is None or conversion.large is None or conversion.small is None:
            return conversion.error is not None
        large, small = self.variant_path(sha, "l"), self.variant_path(sha, "s")
        if not (large.is_file() and small.is_file()):
            return False
        data = large.read_bytes()
        return (
            hashlib.sha256(data).hexdigest() == sha
            and is_plain_webp(data)
            and small.stat().st_size == conversion.small.size_bytes
        )


def _variant(value: object) -> Variant | None:
    if value is None:
        return None
    if not isinstance(value, dict):
        raise TypeError
    return Variant(int(value["width"]), int(value["height"]), int(value["size_bytes"]))


def _optional(value: object) -> str | None:
    if value is None or isinstance(value, str):
        return value
    raise TypeError


def _conversion(value: object) -> Conversion:
    if not isinstance(value, dict):
        raise TypeError
    return Conversion(
        str(value["source_sha256"]),
        _optional(value["source_format"]),
        _optional(value["error"]),
        _variant(value["large"]),
        _variant(value["small"]),
        _optional(value["large_sha256"]),
    )
