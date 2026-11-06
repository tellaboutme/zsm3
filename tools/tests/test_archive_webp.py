import pytest

from zsm3_tools.archive_webp import chunk_layout, is_plain_webp


def riff(*chunks: tuple[bytes, bytes]) -> bytes:
    body = b"WEBP" + b"".join(
        name + len(payload).to_bytes(4, "little") + payload + b"\0" * (len(payload) % 2)
        for name, payload in chunks
    )
    return b"RIFF" + len(body).to_bytes(4, "little") + body


@pytest.mark.parametrize(
    ("data", "layout"),
    [
        (riff((b"VP8 ", b"abcd")), ("VP8 ",)),
        (riff((b"VP8X", b"x" * 10), (b"ALPH", b"a"), (b"VP8 ", b"b")), ("VP8X", "ALPH", "VP8 ")),
        (riff((b"VP8 ", b"abc"), (b"EXIF", b"x")), ("VP8 ", "EXIF")),
        (b"RIFF", None),
        (b"JUNK" + riff((b"VP8 ", b"ab"))[4:], None),
        (riff((b"VP8 ", b"ab"))[:-1], None),
        (riff((b"VP8 ", b"ab")) + b"x", None),
    ],
)
def test_the_chunk_layout_is_read_exactly(data: bytes, layout: tuple[str, ...] | None) -> None:
    assert chunk_layout(data) == layout


def test_truncated_chunk_headers_and_overruns_are_refused() -> None:
    whole = riff((b"VP8 ", b"abcd"))
    header_cut = whole[:16]
    header_cut = header_cut[:4] + (len(header_cut) - 8).to_bytes(4, "little") + header_cut[8:]
    overrun = whole[:16] + (100).to_bytes(4, "little") + whole[20:]

    assert chunk_layout(header_cut) is None
    assert chunk_layout(overrun) is None


def test_only_the_gallery_layouts_count_as_plain() -> None:
    assert is_plain_webp(riff((b"VP8L", b"abcd")))
    assert not is_plain_webp(riff((b"VP8 ", b"ab"), (b"EXIF", b"x")))
    assert not is_plain_webp(b"")
