import http.client
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import Protocol
from urllib.parse import quote, unquote, urldefrag, urljoin, urlsplit, urlunsplit

HOST = "www.zespolszkolmechanicznych.edu.pl"
ORIGIN = "https://" + HOST
AGENT = "ZSM3ContentInventory/1.0"
HTML_SUFFIXES = ("", ".html", ".htm", ".php")
EXCLUDED_PREFIXES = ("/wp-admin", "/wp-json", "/wp-login.php")
DOT_SEGMENTS = (".", "..")
PATH_SAFE = "/:@!$&'()*+,;=-._~"
REQUEST_TIMEOUT_SECONDS = 15
HTTP_OK = 200


class InventoryError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Response:
    status: int
    content_type: str
    body: bytes


class Transport(Protocol):
    def get(self, url: str, max_bytes: int) -> Response: ...


def encode_path(path: str) -> str:
    return quote(unquote(path), safe=PATH_SAFE)


def has_dot_segment(path: str) -> bool:
    return any(segment in DOT_SEGMENTS for segment in unquote(path).split("/"))


def is_html_path(path: str) -> bool:
    return PurePosixPath(path).suffix.lower() in HTML_SUFFIXES


def is_pdf_path(path: str) -> bool:
    return path.lower().endswith(".pdf")


def canonical_url(url: str, base: str = ORIGIN) -> str | None:
    try:
        parsed = urlsplit(urldefrag(urljoin(base, url)).url)
        if (
            parsed.scheme != "https"
            or parsed.netloc != HOST
            or parsed.username is not None
            or parsed.password is not None
        ):
            return None
        if has_dot_segment(parsed.path):
            return None
        path = encode_path(parsed.path or "/")
        if path.lower().startswith(EXCLUDED_PREFIXES):
            return None
        return urlunsplit((parsed.scheme, parsed.netloc, path, "", ""))
    except ValueError:
        return None


class HttpTransport:
    def get(self, url: str, max_bytes: int) -> Response:
        if canonical_url(url) != url:
            message = "unsafe transport URL"
            raise InventoryError(message)
        path = urlsplit(url).path
        robots = path == "/robots.txt"
        if not robots and not is_html_path(path):
            message = "only HTML pages may be fetched"
            raise InventoryError(message)
        connection = http.client.HTTPSConnection(HOST, timeout=REQUEST_TIMEOUT_SECONDS)
        try:
            connection.request("GET", path, headers={"User-Agent": AGENT})
            stream = connection.getresponse()
            content_type = stream.headers.get_content_type()
            allowed_type = "text/plain" if robots else "text/html"
            length = stream.headers.get("Content-Length")
            encoding = stream.headers.get("Content-Encoding", "identity")
            if (
                stream.status != HTTP_OK
                or stream.headers.get("Content-Type") is None
                or content_type != allowed_type
                or encoding.lower() != "identity"
            ):
                return Response(stream.status, content_type, b"")
            if length is not None and (not length.isdecimal() or int(length) > max_bytes):
                message = "response exceeds size limit or has invalid length"
                raise InventoryError(message)
            body = stream.read(max_bytes + 1)
        finally:
            connection.close()
        if len(body) > max_bytes:
            message = "response exceeds size limit"
            raise InventoryError(message)
        return Response(HTTP_OK, content_type, body)
