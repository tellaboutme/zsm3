import io
from pathlib import Path

from PIL import Image

ORIENTATION_TAG = 0x0112
GPS_TAG = 0x8825
ARTIST_TAG = 0x013B
PRIVATE_NOTE = "Jan Kowalski 9Z"


class _Sequence:
    def __init__(self, seed: int) -> None:
        self.state = seed * 2_654_435_761 % 2**32 or 1

    def randrange(self, limit: int) -> int:
        self.state = (1_103_515_245 * self.state + 12_345) % 2**31
        return self.state % limit


def picture(size: tuple[int, int], seed: int, mode: str = "RGB") -> Image.Image:
    rng = _Sequence(seed)
    width, height = size
    image = Image.new(mode, size)
    channels = len(mode)
    base = [rng.randrange(256) for _ in range(channels)]
    pixels = [
        tuple(
            (base[c] + x * (c + 1) + y * (3 - c) + rng.randrange(24)) % 256 for c in range(channels)
        )
        for y in range(0, height, 8)
        for x in range(0, width, 8)
    ]
    small = Image.new(mode, ((width + 7) // 8, (height + 7) // 8))
    small.putdata(pixels)
    image.paste(small.resize(size, Image.Resampling.BILINEAR))
    return image


def encoded(image: Image.Image, kind: str, **options: object) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, kind, **options)
    return buffer.getvalue()


def jpeg(size: tuple[int, int], seed: int, orientation: int | None = None) -> bytes:
    image = picture(size, seed)
    exif = Image.Exif()
    exif[ARTIST_TAG] = PRIVATE_NOTE
    if orientation is not None:
        exif[ORIENTATION_TAG] = orientation
    return encoded(image, "JPEG", quality=90, exif=exif.tobytes(), comment=PRIVATE_NOTE.encode())


def png_with_alpha(size: tuple[int, int], seed: int) -> bytes:
    return encoded(picture(size, seed, "RGBA"), "PNG")


def write(root: Path, relative: str, data: bytes) -> Path:
    path = root.joinpath(*relative.split("/"))
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return path


def archive(root: Path, albums: int, per_album: int) -> dict[str, bytes]:
    files: dict[str, bytes] = {}
    for album in range(albums):
        year = 2015 + album % 8
        folder = f"{year}-{year + 1}/Wycieczka nr {album} \u2013 Kraków"
        for index in range(per_album):
            data = jpeg((640 + 16 * index, 480), seed=album * 100 + index)
            files[f"{folder}/IMG_{index:04d}.jpg"] = data
    for relative, data in files.items():
        write(root, relative, data)
    return files
