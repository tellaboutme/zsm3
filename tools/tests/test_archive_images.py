import io

import pytest
from PIL import Image

from archive_fixtures import PRIVATE_NOTE, encoded, jpeg, picture, png_with_alpha
from zsm3_tools import archive_images
from zsm3_tools.archive_images import convert
from zsm3_tools.archive_model import Settings
from zsm3_tools.archive_webp import chunk_layout

SETTINGS = Settings()


def _size(data: bytes) -> tuple[int, int]:
    with Image.open(io.BytesIO(data)) as image:
        return image.size


@pytest.mark.parametrize(
    ("source", "large", "small"),
    [
        ((3200, 2400), (1600, 1200), (400, 300)),
        ((900, 1800), (800, 1600), (200, 400)),
        ((1000, 1000), (1000, 1000), (400, 400)),
        ((401, 3), (401, 3), (400, 3)),
    ],
)
def test_variants_keep_the_aspect_ratio_within_the_gallery_bounds(
    source: tuple[int, int], large: tuple[int, int], small: tuple[int, int]
) -> None:
    result = convert(encoded(picture(source, 1), "PNG"), SETTINGS)

    assert result.conversion.error is None
    assert (_size(result.large), _size(result.small)) == (large, small)
    assert result.conversion.large is not None
    assert (result.conversion.large.width, result.conversion.large.height) == large
    assert result.conversion.source_format == "PNG"


def test_exif_orientation_is_applied_and_every_metadata_chunk_is_dropped() -> None:
    result = convert(jpeg((1200, 800), 2, orientation=6), SETTINGS)

    assert _size(result.large) == (800, 1200)
    for data in (result.large, result.small):
        assert chunk_layout(data) == ("VP8 ",)
        assert PRIVATE_NOTE.encode() not in data
        assert b"Exif" not in data
        assert b"ICCP" not in data
        assert b"XMP " not in data


def test_transparency_survives_in_an_allowed_layout() -> None:
    result = convert(png_with_alpha((800, 600), 3), SETTINGS)

    assert chunk_layout(result.large) == ("VP8X", "ALPH", "VP8 ")
    palette = Image.new("P", (600, 600), 0)
    palette.putpalette([0, 0, 0, 200, 30, 30] + [0] * 762)
    palette.paste(1, (100, 100, 500, 500))
    paletted = convert(encoded(palette, "GIF", transparency=0), SETTINGS)
    assert chunk_layout(paletted.large) == ("VP8X", "ALPH", "VP8 ")


def test_conversion_is_deterministic_and_hashes_the_large_variant() -> None:
    data = jpeg((1700, 900), 5)

    first, second = convert(data, SETTINGS), convert(data, SETTINGS)

    assert (first.large, first.small) == (second.large, second.small)
    assert first.conversion == second.conversion
    assert first.conversion.large_sha256 is not None
    assert len(first.conversion.large_sha256) == 64


def _failure(data: bytes, settings: Settings = SETTINGS) -> str | None:
    result = convert(data, settings)
    assert (result.large, result.small) == (b"", b"")
    return result.conversion.error


def test_unusable_inputs_become_structured_failures(monkeypatch: pytest.MonkeyPatch) -> None:
    good = jpeg((800, 600), 6)
    frames = [picture((500, 500), seed) for seed in (7, 8)]
    animated = encoded(frames[0], "GIF", save_all=True, append_images=frames[1:])

    assert _failure(b"not an image at all") == "unsupported_or_corrupt"
    assert _failure(good[: len(good) // 2]) == "corrupt"
    assert _failure(encoded(picture((300, 200), 9), "PNG")) == "too_small"
    assert _failure(good, Settings(max_pixels=1000)) == "too_many_pixels"
    assert _failure(animated) == "animated"
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 100_000)
    assert _failure(good) == "too_many_pixels"
    monkeypatch.setattr(Image, "MAX_IMAGE_PIXELS", 10_000)
    assert _failure(good) == "too_many_pixels"


def test_an_oversized_or_unexpected_encoding_is_refused(monkeypatch: pytest.MonkeyPatch) -> None:
    data = jpeg((800, 600), 10)
    monkeypatch.setattr(archive_images, "MAX_VARIANT_BYTES", 10)
    assert _failure(data) == "variant_too_large"
    monkeypatch.undo()
    monkeypatch.setattr(archive_images, "is_plain_webp", lambda _: False)
    assert _failure(data) == "unexpected_webp_layout"


def test_the_quality_ladder_steps_down_until_a_variant_fits(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    data = jpeg((1600, 1200), 11)
    full = convert(data, SETTINGS)
    assert full.conversion.large is not None
    limit = full.conversion.large.size_bytes - 1
    monkeypatch.setattr(archive_images, "MAX_VARIANT_BYTES", limit)

    smaller = convert(data, SETTINGS)

    assert smaller.conversion.large is not None
    assert smaller.conversion.large.size_bytes <= limit
