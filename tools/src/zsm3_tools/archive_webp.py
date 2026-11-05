RIFF_HEADER_BYTES = 12
CHUNK_HEADER_BYTES = 8
ALLOWED_LAYOUTS = frozenset(
    {("VP8 ",), ("VP8L",), ("VP8X", "VP8 "), ("VP8X", "VP8L"), ("VP8X", "ALPH", "VP8 ")}
)


def chunk_layout(data: bytes) -> tuple[str, ...] | None:
    if len(data) < RIFF_HEADER_BYTES or data[:4] != b"RIFF" or data[8:12] != b"WEBP":
        return None
    if int.from_bytes(data[4:8], "little") != len(data) - CHUNK_HEADER_BYTES:
        return None
    chunks: list[str] = []
    offset = RIFF_HEADER_BYTES
    while offset < len(data):
        if offset + CHUNK_HEADER_BYTES > len(data):
            return None
        size = int.from_bytes(data[offset + 4 : offset + 8], "little")
        chunks.append(data[offset : offset + 4].decode("latin-1"))
        offset += CHUNK_HEADER_BYTES + size + size % 2
    return tuple(chunks) if offset == len(data) else None


def is_plain_webp(data: bytes) -> bool:
    return chunk_layout(data) in ALLOWED_LAYOUTS
