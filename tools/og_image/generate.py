"""Draw apps/web/public/og-default.png (1200x630) with the site brand.

Run `python og_image/generate.py` from tools/ with Pillow installed, then commit the PNG.
"""

from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

WIDTH = 1200
HEIGHT = 630
MARGIN = 88
CONTENT_WIDTH = WIDTH - 2 * MARGIN
BAND_TOP = 470

WHITE = (0xFF, 0xFF, 0xFF)
INK = (0x0B, 0x12, 0x20)
BLUE = (0x0B, 0x4F, 0xB3)
BLUE_DIM = (0xC5, 0xD6, 0xF3)
ORANGE = (0xF2, 0x6B, 0x1D)

MARK = "ZSM"
MARK_ACCENT = "3"
NAME_LINES = ("Zespół Szkół", "Mechanicznych nr 3")
DESCRIPTOR = "Technikum i szkoła branżowa w Nowej Hucie"
ADDRESS = "os. Szkolne 37, 31-978 Kraków"

MARK_SIZE = 180
MARK_BASELINE = 222
RULE_TOP = 254
RULE_HEIGHT = 8
RULE_WIDTH = 112
NAME_SIZE = 68
NAME_BASELINE = 332
NAME_LEADING = 74
DESCRIPTOR_SIZE = 38
DESCRIPTOR_BASELINE = 528
ADDRESS_SIZE = 30
ADDRESS_BASELINE = 574

EXTENDED_LETTERS = frozenset("ąćęłńśźżĄĆĘŁŃŚŹŻ")

REPOSITORY = Path(__file__).resolve().parents[2]
OUTPUT = REPOSITORY / "apps/web/public/og-default.png"


@dataclass(frozen=True)
class FontSource:
    package: str
    family: str
    token: str
    axes: tuple[float, ...] = ()


@dataclass(frozen=True)
class Placement:
    x: float
    baseline: float
    fill: tuple[int, int, int]
    align: str = "left"


DISPLAY = FontSource("@fontsource-variable/archivo", "archivo", "wdth", (900, 125))
BODY = FontSource("@fontsource-variable/source-sans-3", "source-sans-3", "wght", (600,))
MONO = FontSource("@fontsource/ibm-plex-mono", "ibm-plex-mono", "400")

FontPair = tuple[ImageFont.FreeTypeFont, ImageFont.FreeTypeFont]


def font_file(package: str, asset: str) -> Path:
    store = package.replace("/", "+")
    pattern = f"node_modules/.pnpm/{store}@*/node_modules/{package}/files/{asset}"
    candidates = sorted(REPOSITORY.glob(pattern))
    if not candidates:
        message = f"{package}/files/{asset} is missing; run pnpm install first"
        raise FileNotFoundError(message)
    return candidates[0]


def load_pair(source: FontSource, size: int) -> FontPair:
    pair: list[ImageFont.FreeTypeFont] = []
    for subset in ("latin", "latin-ext"):
        asset = f"{source.family}-{subset}-{source.token}-normal.woff2"
        font = ImageFont.truetype(str(font_file(source.package, asset)), size)
        if source.axes:
            font.set_variation_by_axes(list(source.axes))
        pair.append(font)
    first, second = pair
    return first, second


def runs(text: str, fonts: FontPair) -> Iterator[tuple[ImageFont.FreeTypeFont, str]]:
    latin, extended = fonts
    current: ImageFont.FreeTypeFont | None = None
    chunk = ""
    for character in text:
        font = extended if character in EXTENDED_LETTERS else latin
        if font is not current and chunk:
            yield current, chunk
            chunk = ""
        current = font
        chunk += character
    if current is not None:
        yield current, chunk


def measure(text: str, fonts: FontPair) -> float:
    return sum(font.getlength(chunk) for font, chunk in runs(text, fonts))


def place(draw: ImageDraw.ImageDraw, text: str, fonts: FontPair, at: Placement) -> float:
    width = measure(text, fonts)
    if width > CONTENT_WIDTH:
        message = f"'{text}' is {width:.0f}px wide, the content box is {CONTENT_WIDTH}px"
        raise ValueError(message)
    cursor = at.x - width if at.align == "right" else at.x
    for font, chunk in runs(text, fonts):
        draw.text((cursor, at.baseline), chunk, font=font, fill=at.fill, anchor="ls")
        cursor += font.getlength(chunk)
    return width


def render() -> Image.Image:
    image = Image.new("RGB", (WIDTH, HEIGHT), WHITE)
    draw = ImageDraw.Draw(image)
    display = load_pair(DISPLAY, MARK_SIZE)
    mark = place(draw, MARK, display, Placement(MARGIN, MARK_BASELINE, INK))
    draw.text(
        (MARGIN + mark, MARK_BASELINE), MARK_ACCENT, font=display[0], fill=ORANGE, anchor="ls"
    )
    draw.rectangle((MARGIN, RULE_TOP, MARGIN + RULE_WIDTH, RULE_TOP + RULE_HEIGHT), fill=ORANGE)
    names = load_pair(DISPLAY, NAME_SIZE)
    for index, text in enumerate(NAME_LINES):
        place(draw, text, names, Placement(MARGIN, NAME_BASELINE + index * NAME_LEADING, INK))
    draw.rectangle((0, BAND_TOP, WIDTH, HEIGHT), fill=BLUE)
    place(
        draw,
        DESCRIPTOR,
        load_pair(BODY, DESCRIPTOR_SIZE),
        Placement(MARGIN, DESCRIPTOR_BASELINE, WHITE),
    )
    place(
        draw,
        ADDRESS,
        load_pair(MONO, ADDRESS_SIZE),
        Placement(WIDTH - MARGIN, ADDRESS_BASELINE, BLUE_DIM, "right"),
    )
    return image


def main() -> int:
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    render().save(OUTPUT, format="PNG", optimize=True, compress_level=9)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
