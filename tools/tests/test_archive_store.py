import json
from pathlib import Path

import pytest

from archive_fixtures import jpeg
from zsm3_tools.archive_images import Encoded, convert
from zsm3_tools.archive_model import Conversion, Settings
from zsm3_tools.archive_paths import RUN_MARKER
from zsm3_tools.archive_store import Store

SETTINGS = Settings()


@pytest.fixture
def store(tmp_path: Path) -> Store:
    created = Store(tmp_path / "out", SETTINGS)
    created.prepare()
    return created


@pytest.fixture(scope="module")
def encoded() -> Encoded:
    return convert(jpeg((900, 600), 1), SETTINGS)


def test_a_saved_conversion_is_reused_only_while_everything_matches(
    store: Store, encoded: Encoded
) -> None:
    sha = encoded.conversion.source_sha256
    store.save("photo", encoded)

    assert store.load("photo", sha) == encoded.conversion
    assert store.load("photo", "0" * 64) is None
    assert store.load("other", sha) is None
    assert Store(store.root, Settings(quality=70)).load("photo", sha) is None
    assert (store.root / RUN_MARKER).read_text(encoding="utf-8") == SETTINGS.key() + "\n"


def test_damaged_variants_make_the_record_stale(store: Store, encoded: Encoded) -> None:
    sha = encoded.conversion.source_sha256
    large_sha = encoded.conversion.large_sha256
    assert large_sha is not None
    store.save("photo", encoded)
    large = store.variant_path(large_sha, "l")
    small = store.variant_path(large_sha, "s")

    small.write_bytes(b"short")
    assert store.load("photo", sha) is None
    store.save("photo", encoded)
    large.write_bytes(encoded.large[:-2] + b"xx")
    assert store.load("photo", sha) is None
    large.unlink()
    assert store.load("photo", sha) is None


def test_failed_conversions_are_remembered_too(store: Store) -> None:
    failed = Conversion("a" * 64, None, "corrupt", None, None, None)
    store.save("broken", Encoded(failed, b"", b""))

    assert store.load("broken", "a" * 64) == failed


@pytest.mark.parametrize(
    "record",
    [
        "not json",
        json.dumps({"version": 1}),
        json.dumps({"version": 1, "settings": SETTINGS.key(), "conversion": []}),
        json.dumps(
            {
                "version": 1,
                "settings": SETTINGS.key(),
                "conversion": {
                    "source_sha256": "a",
                    "source_format": 3,
                    "error": None,
                    "large": None,
                    "small": None,
                    "large_sha256": None,
                },
            }
        ),
        json.dumps(
            {
                "version": 1,
                "settings": SETTINGS.key(),
                "conversion": {
                    "source_sha256": "a",
                    "source_format": None,
                    "error": None,
                    "large": [1],
                    "small": None,
                    "large_sha256": None,
                },
            }
        ),
        json.dumps(
            {
                "version": 2,
                "settings": SETTINGS.key(),
                "conversion": {
                    "source_sha256": "a",
                    "source_format": None,
                    "error": "corrupt",
                    "large": None,
                    "small": None,
                    "large_sha256": None,
                },
            }
        ),
    ],
)
def test_unreadable_or_outdated_records_are_ignored(store: Store, record: str) -> None:
    (store.records / "photo.json").write_text(record, encoding="utf-8")

    assert store.load("photo", "a") is None


def test_a_converted_record_without_variant_sizes_is_stale(store: Store) -> None:
    half = Conversion("a", "JPEG", None, None, None, "b" * 64)
    store.save("photo", Encoded(half, b"", b""))

    assert store.load("photo", "a") is None


def test_preparing_again_removes_interrupted_writes(store: Store) -> None:
    (store.records / ".photo.json.partial").write_bytes(b"{")
    (store.variants / ".x-l.webp.partial").write_bytes(b"RIFF")

    assert store.prepare() == 2
    assert list(store.records.iterdir()) == []
