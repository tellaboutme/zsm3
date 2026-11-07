import re
from dataclasses import dataclass
from urllib.parse import quote, urlsplit

from zsm3_tools.inventory_http import HOST, has_dot_segment
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
LEGACY_HOSTS = frozenset({HOST, HOST.removeprefix("www.")})

_SUFFIX = re.compile(r"\.([a-z0-9]+)$")
_PATH_ENCODED = frozenset('"<>`{}')
BROWSER_SAFE = "".join(
    chr(code) for code in range(0x21, 0x7F) if chr(code) not in _PATH_ENCODED | {"\\"}
)


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
    if parsed.netloc != "" and parsed.hostname not in LEGACY_HOSTS:
        message = "not on the old site"
        raise LegacyPathError(message)
    if has_dot_segment(parsed.path):
        message = "contains dot segments"
        raise LegacyPathError(message)
    if "\\" in parsed.path:
        message = "contains a backslash, which browsers read as a slash"
        raise LegacyPathError(message)
    request = browser_path(parsed.path or "/")
    if len(request) > MAX_PATH_LENGTH:
        message = f"longer than {MAX_PATH_LENGTH} characters once encoded"
        raise LegacyPathError(message)
    return LegacyPath(request, lookup_key_of(request), parsed.query != "")


def browser_path(path: str) -> str:
    return quote(path, safe=BROWSER_SAFE)


def lookup_key_of(path: str) -> str:
    return normalise_from_path(browser_path(path))


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
