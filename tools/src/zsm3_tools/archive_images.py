import hashlib
import io
import warnings
from dataclasses import dataclass
from enum import StrEnum

from PIL import Image, ImageOps, UnidentifiedImageError

from zsm3_tools.archive_model import (
    LARGE_LONG_EDGE,
    MAX_VARIANT_BYTES,
    SMALL_LONG_EDGE,
    Conversion,
    Settings,
    Variant,
)
from zsm3_tools.archive_webp import is_plain_webp

FORMATS = ("JPEG", "PNG", "WEBP", "GIF", "BMP", "TIFF")
QUALITY_STEP = 8
WEBP_METHOD = 4
MIN_QUALITY = 50
ALPHA_MODES = frozenset({"RGBA", "LA", "PA"})


@dataclass(frozen=True, slots=True)
class Encoded:
    conversion: Conversion
    large: bytes
    small: bytes


class Failure(StrEnum):
    TOO_MANY_PIXELS = "too_many_pixels"
    UNSUPPORTED = "unsupported_or_corrupt"
    ANIMATED = "animated"
    CORRUPT = "corrupt"
    TOO_SMALL = "too_small"
    LAYOUT = "unexpected_webp_layout"
    TOO_LARGE = "variant_too_large"


class ConversionError(ValueError):
    def __init__(self, failure: Failure) -> None:
        super().__init__(failure.value)
        self.failure = failure


def _open(data: bytes, settings: Settings) -> tuple[Image.Image, str]:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            image = Image.open(io.BytesIO(data), formats=FORMATS)
    except (Image.DecompressionBombError, Image.DecompressionBombWarning) as error:
        raise ConversionError(Failure.TOO_MANY_PIXELS) from error
    except UnidentifiedImageError as error:
        raise ConversionError(Failure.UNSUPPORTED) from error
    width, height = image.size
    if width * height > settings.max_pixels:
        raise ConversionError(Failure.TOO_MANY_PIXELS)
    if getattr(image, "n_frames", 1) > 1:
        raise ConversionError(Failure.ANIMATED)
    return image, image.format or "unknown"


def _decode(image: Image.Image) -> Image.Image:
    try:
        image.load()
        upright = ImageOps.exif_transpose(image)
    except (OSError, SyntaxError, ValueError) as error:
        raise ConversionError(Failure.CORRUPT) from error
    has_alpha = upright.mode in ALPHA_MODES or "transparency" in upright.info
    mode = "RGBA" if has_alpha else "RGB"
    converted = upright.convert(mode)
    return Image.frombytes(mode, converted.size, converted.tobytes())


def _scaled(size: tuple[int, int], long_edge: int) -> tuple[int, int]:
    width, height = size
    if width >= height:
        return long_edge, max(1, round(height * long_edge / width))
    return max(1, round(width * long_edge / height)), long_edge


def _encode(image: Image.Image, quality: int) -> bytes:
    for attempt in range(quality, MIN_QUALITY - 1, -QUALITY_STEP):
        buffer = io.BytesIO()
        image.save(buffer, "WEBP", quality=attempt, method=WEBP_METHOD, exif=b"", xmp=b"")
        data = buffer.getvalue()
        if len(data) <= MAX_VARIANT_BYTES:
            if not is_plain_webp(data):
                raise ConversionError(Failure.LAYOUT)
            return data
    raise ConversionError(Failure.TOO_LARGE)


def variants(image: Image.Image, quality: int) -> tuple[bytes, Variant, bytes, Variant]:
    if max(image.size) < SMALL_LONG_EDGE:
        raise ConversionError(Failure.TOO_SMALL)
    large_size = _scaled(image.size, min(LARGE_LONG_EDGE, max(image.size)))
    large_image = image.resize(large_size, Image.Resampling.LANCZOS)
    small_image = large_image.resize(_scaled(large_size, SMALL_LONG_EDGE), Image.Resampling.LANCZOS)
    large = _encode(large_image, quality)
    small = _encode(small_image, quality)
    return (
        large,
        Variant(*large_image.size, len(large)),
        small,
        Variant(*small_image.size, len(small)),
    )


def convert(data: bytes, settings: Settings) -> Encoded:
    source_sha = hashlib.sha256(data).hexdigest()
    try:
        image, source_format = _open(data, settings)
        with image:
            clean = _decode(image)
        large, large_info, small, small_info = variants(clean, settings.quality)
    except ConversionError as error:
        failed = Conversion(source_sha, None, error.failure.value, None, None, None)
        return Encoded(failed, b"", b"")
    sha = hashlib.sha256(large).hexdigest()
    done = Conversion(source_sha, source_format, None, large_info, small_info, sha)
    return Encoded(done, large, small)
