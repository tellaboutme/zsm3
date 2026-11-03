import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from zsm3_tools.inventory_http import encode_path, has_dot_segment
from zsm3_tools.redirect_paths import normalise_from_path

FILE_SUFFIXES = (
    "ico",
    "txt",
    "xml",
    "json",
    "css",
    "js",
    "mjs",
    "map",
    "png",
    "jpg",
    "jpeg",
    "webp",
    "svg",
    "gif",
    "avif",
    "woff",
    "woff2",
    "ttf",
    "pdf",
    "webmanifest",
    "wasm",
    "mp4",
    "webm",
)
RESERVED_PREFIXES = ("/api", "/media", "/panel", "/_astro", "/.well-known")
DOCUMENT_SUFFIXES = ("pdf", "doc", "docx", "xls", "xlsx", "ppt", "pptx", "odt", "ods", "odp")
MAX_PATH_LENGTH = 500

_SUFFIX = re.compile(r"\.([a-z0-9]+)$")


class LegacyPathError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class LegacyPath:
    request_path: str
    lookup_key: str
    had_query: bool


def legacy_path(raw: str) -> LegacyPath:
    value = raw.strip()
    if value == "" or any(character.isspace() for character in value):
        message = "empty or contains whitespace"
        raise LegacyPathError(message)
    parsed = urlsplit(value)
    if parsed.scheme not in {"", "http", "https"} or not (parsed.path or "/").startswith("/"):
        message = "not a site path or web address"
        raise LegacyPathError(message)
    if has_dot_segment(parsed.path):
        message = "contains dot segments"
        raise LegacyPathError(message)
    request = encode_path(parsed.path or "/")
    if len(request) > MAX_PATH_LENGTH:
        message = f"longer than {MAX_PATH_LENGTH} characters once encoded"
        raise LegacyPathError(message)
    return LegacyPath(request, normalise_from_path(request), parsed.query != "")


def suffix_of(path: str) -> str:
    match = _SUFFIX.search(path.lower())
    return "" if match is None else match.group(1)


def is_reserved(path: str) -> bool:
    lowered = path.lower()
    return any(
        lowered == prefix or lowered.startswith(prefix + "/") for prefix in RESERVED_PREFIXES
    )


def is_redirectable(path: str) -> bool:
    return suffix_of(path) not in FILE_SUFFIXES and not is_reserved(path)


def is_document(path: str) -> bool:
    return suffix_of(path) in DOCUMENT_SUFFIXES
