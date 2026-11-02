import http.client
from dataclasses import dataclass, field
from unittest.mock import Mock

import pytest

from zsm3_tools import content_inventory
from zsm3_tools.content_inventory import Entry, Limits, inventory, review_flags
from zsm3_tools.inventory_http import (
    AGENT,
    ORIGIN,
    HttpTransport,
    InventoryError,
    Response,
    canonical_url,
)


@dataclass
class FakeTransport:
    responses: dict[str, Response]
    requests: list[str] = field(default_factory=list)

    def get(self, url: str, max_bytes: int) -> Response:
        self.requests.append(url)
        response = self.responses[url]
        if len(response.body) > max_bytes:
            message = "response exceeds size limit"
            raise InventoryError(message)
        return response


def test_url_scope_and_query_minimization() -> None:
    assert canonical_url("/news?email=private@example.com#part") == ORIGIN + "/news"
    assert canonical_url("https://evil.example/a") is None
    assert canonical_url("//www.zespolszkolmechanicznych.edu.pl.evil.example/a") is None
    assert canonical_url("http://www.zespolszkolmechanicznych.edu.pl/a") is None
    assert canonical_url("https://user@www.zespolszkolmechanicznych.edu.pl/a") is None
    assert canonical_url("http://[invalid") is None
    assert canonical_url("/wp-admin/users.php") is None
    assert canonical_url("/wp-json/wp/v2/users") is None
    assert canonical_url("/wp-login.php") is None


def test_crawl_records_provenance_and_never_fetches_pdfs_or_assets() -> None:
    home = ORIGIN + "/"
    page = ORIGIN + "/page"
    document = ORIGIN + "/form.pdf"
    transport = FakeTransport(
        {
            ORIGIN + "/robots.txt": Response(
                200, "text/plain", b"User-agent: *\nDisallow: /secret"
            ),
            home: Response(
                200,
                "text/html",
                b'<a href="/page?q=1">A</a><a href="/form.pdf">B</a>'
                b'<a href="/secret">C</a><a href="/photo.jpg">D</a>'
                b'<a href="https://outside.example/">E</a><a href="/page">F</a>',
            ),
            page: Response(200, "text/html", b'<a href="/">Home</a>'),
        }
    )
    waits: list[float] = []

    entries = inventory([home], transport, pause=waits.append)

    assert entries == [
        Entry(home, "html", "discovered", None, 0),
        Entry(page, "html", "discovered", home, 1),
        Entry(document, "pdf", "linked_not_downloaded", home, 1),
        Entry(ORIGIN + "/secret", "html", "robots_denied", home, 1),
    ]
    assert transport.requests == [ORIGIN + "/robots.txt", home, page]
    assert waits == [1.0, 1.0]


def test_limit_marks_unresolved_links() -> None:
    home = ORIGIN + "/"
    transport = FakeTransport(
        {
            ORIGIN + "/robots.txt": Response(200, "text/plain", b"User-agent: *\nAllow: /"),
            home: Response(200, "text/html", b'<a href="/a">A</a>'),
        }
    )
    assert inventory([home], transport, limits=Limits(depth=0), pause=lambda _: None)[1] == Entry(
        ORIGIN + "/a", "html", "limit_not_fetched", home, 1
    )


def test_html_extensions_and_robots_pacing() -> None:
    home = ORIGIN + "/"
    transport = FakeTransport(
        {
            ORIGIN + "/robots.txt": Response(
                200, "text/plain", b"User-agent: *\nCrawl-delay: 3\nRequest-rate: 1/5"
            ),
            home: Response(200, "text/html", b'<a href="/old.html">A</a><a href="/old.php">B</a>'),
        }
    )
    waits: list[float] = []
    entries = inventory([home], transport, limits=Limits(depth=0), pause=waits.append)
    assert [entry.url for entry in entries] == [home, ORIGIN + "/old.html", ORIGIN + "/old.php"]
    assert waits == [5.0]


def test_robots_failure_stops_before_crawl() -> None:
    transport = FakeTransport({ORIGIN + "/robots.txt": Response(404, "", b"")})
    with pytest.raises(InventoryError, match=r"robots\.txt unavailable"):
        inventory([ORIGIN + "/"], transport)
    assert transport.requests == [ORIGIN + "/robots.txt"]


def test_http_and_content_failures_are_explicit() -> None:
    transport = FakeTransport(
        {
            ORIGIN + "/robots.txt": Response(200, "text/plain", b"User-agent: *\nAllow: /"),
            ORIGIN + "/": Response(503, "", b""),
            ORIGIN + "/other": Response(200, "application/json", b"{}"),
        }
    )
    assert [
        entry.status
        for entry in inventory([ORIGIN + "/", ORIGIN + "/other"], transport, pause=lambda _: None)
    ] == ["http_503", "not_html_or_too_large"]


def test_rejects_invalid_limits_and_foreign_seeds() -> None:
    transport = FakeTransport({ORIGIN + "/robots.txt": Response(200, "text/plain", b"")})
    with pytest.raises(InventoryError, match="limits"):
        inventory([ORIGIN], transport, limits=Limits(delay=0))
    with pytest.raises(InventoryError, match="seed"):
        inventory(["https://other.example/"], transport)
    for delay in (float("nan"), float("inf"), float("-inf")):
        with pytest.raises(InventoryError, match="limits"):
            inventory([ORIGIN + "/"], transport, limits=Limits(delay=delay))
    with pytest.raises(InventoryError, match="HTML page"):
        inventory([ORIGIN + "/photo.jpg"], transport)
    with pytest.raises(InventoryError, match="HTML page"):
        inventory([ORIGIN + "/form.pdf"], transport)


def test_network_transport_is_bounded_and_does_not_follow_redirects(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    stream = Mock()
    stream.status = 302
    stream.headers.get_content_type.return_value = "text/html"
    stream.read.return_value = b"ok"
    connection = Mock()
    connection.getresponse.return_value = stream
    monkeypatch.setattr(http.client, "HTTPSConnection", lambda *_a, **_k: connection)
    client = HttpTransport()
    assert client.get(ORIGIN + "/", 10) == Response(302, "text/html", b"")
    stream.read.assert_not_called()
    connection.request.assert_called_once_with("GET", "/", headers={"User-Agent": AGENT})
    connection.close.assert_called_once()
    with pytest.raises(InventoryError, match="unsafe transport URL"):
        client.get("https://foreign.example", 10)
    with pytest.raises(InventoryError, match="only HTML"):
        client.get(ORIGIN + "/person.jpg", 10)
    stream.status = 200
    stream.headers.get.side_effect = lambda name, default=None: (
        "text/html" if name == "Content-Type" else default
    )
    stream.read.return_value = b"long"
    with pytest.raises(InventoryError, match="size limit"):
        client.get(ORIGIN + "/", 2)
    stream.read.return_value = b"ok"
    assert client.get(ORIGIN + "/", 2) == Response(200, "text/html", b"ok")


def test_network_transport_closes_on_failure(monkeypatch: pytest.MonkeyPatch) -> None:
    connection = Mock()
    connection.request.side_effect = OSError("offline")
    monkeypatch.setattr(http.client, "HTTPSConnection", lambda *_a, **_k: connection)
    with pytest.raises(OSError, match="offline"):
        HttpTransport().get(ORIGIN + "/", 1)
    connection.close.assert_called_once()


@pytest.mark.parametrize(
    "content_type", ["image/jpeg", "application/pdf", "application/octet-stream"]
)
def test_extensionless_binary_seed_is_not_downloaded(
    content_type: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    stream = Mock()
    stream.status = 200
    stream.headers.get_content_type.return_value = content_type
    stream.headers.get.side_effect = lambda name, default=None: (
        content_type if name == "Content-Type" else default
    )
    connection = Mock()
    connection.getresponse.return_value = stream
    monkeypatch.setattr(http.client, "HTTPSConnection", lambda *_a, **_k: connection)
    assert HttpTransport().get(ORIGIN + "/extensionless", 100) == Response(200, content_type, b"")
    stream.read.assert_not_called()


@pytest.mark.parametrize("length", ["101", "not-a-number"])
def test_content_length_is_checked_before_body(
    length: str, monkeypatch: pytest.MonkeyPatch
) -> None:
    stream = Mock()
    stream.status = 200
    stream.headers.get_content_type.return_value = "text/html"
    stream.headers.get.side_effect = lambda name, default=None: (
        length if name == "Content-Length" else "text/html" if name == "Content-Type" else default
    )
    connection = Mock()
    connection.getresponse.return_value = stream
    monkeypatch.setattr(http.client, "HTTPSConnection", lambda *_a, **_k: connection)
    with pytest.raises(InventoryError, match="size limit or has invalid length"):
        HttpTransport().get(ORIGIN + "/", 100)
    stream.read.assert_not_called()


def test_missing_type_and_compressed_body_are_not_read(monkeypatch: pytest.MonkeyPatch) -> None:
    stream = Mock()
    stream.status = 200
    stream.headers.get_content_type.return_value = "text/html"
    stream.headers.get.side_effect = lambda name, default=None: (
        "gzip" if name == "Content-Encoding" else default
    )
    connection = Mock()
    connection.getresponse.return_value = stream
    monkeypatch.setattr(http.client, "HTTPSConnection", lambda *_a, **_k: connection)
    assert HttpTransport().get(ORIGIN + "/", 100).body == b""
    stream.read.assert_not_called()


def test_robots_transport_error_and_page_error(monkeypatch: pytest.MonkeyPatch) -> None:
    transport = FakeTransport({})

    def failing_get(url: str, _max_bytes: int) -> Response:
        if url not in transport.responses or url == ORIGIN + "/":
            message = "offline"
            raise OSError(message)
        return transport.responses[url]

    monkeypatch.setattr(transport, "get", failing_get)
    with pytest.raises(InventoryError, match="robots"):
        inventory([ORIGIN + "/"], transport)
    transport.responses[ORIGIN + "/robots.txt"] = Response(200, "text/plain", b"User-agent: *")
    assert (
        inventory([ORIGIN + "/"], transport, pause=lambda _: None)[0].status
        == "fetch_error:OSError"
    )


def test_robots_wildcards_deny_before_fetch() -> None:
    home = ORIGIN + "/"
    blocked = ORIGIN + "/private/record.html"
    transport = FakeTransport(
        {
            ORIGIN + "/robots.txt": Response(
                200, "text/plain", b"User-agent: *\n# private content\nDisallow: /private/*.html$"
            ),
            home: Response(200, "text/html", b'<a href="/private/record.html">Private</a>'),
        }
    )
    entries = inventory([home], transport, pause=lambda _: None)
    assert entries[1].status == "robots_denied"
    assert blocked not in transport.requests


def test_invalid_robots_stops_before_fetch() -> None:
    transport = FakeTransport(
        {
            ORIGIN + "/robots.txt": Response(200, "text/plain", b"User-agent: *\nDisallow: [bad"),
        }
    )
    with pytest.raises(InventoryError, match=r"robots\.txt invalid"):
        inventory([ORIGIN + "/"], transport)
    assert transport.requests == [ORIGIN + "/robots.txt"]


def test_html_parser_skips_missing_hrefs_and_other_tags() -> None:
    transport = FakeTransport(
        {
            ORIGIN + "/robots.txt": Response(200, "text/plain", b"User-agent: *\nAllow: /"),
            ORIGIN + "/": Response(200, "text/html", b"<div>x</div><a>y</a>"),
        }
    )
    assert inventory([ORIGIN + "/"], transport, pause=lambda _: None)[0].status == "discovered"


def test_page_count_limit_and_discovery_cap(monkeypatch: pytest.MonkeyPatch) -> None:
    home = ORIGIN + "/"
    transport = FakeTransport(
        {
            ORIGIN + "/robots.txt": Response(200, "text/plain", b"User-agent: *\nAllow: /"),
            home: Response(200, "text/html", b'<a href="/a">A</a><a href="/b">B</a>'),
        }
    )
    assert (
        inventory([home], transport, limits=Limits(pages=1), pause=lambda _: None)[1].status
        == "limit_not_fetched"
    )
    monkeypatch.setattr(content_inventory, "MAX_DISCOVERED", 1)
    assert inventory([home], transport, pause=lambda _: None)[0].status == "discovery_limit"


def test_pdf_and_unresolved_items_require_review() -> None:
    pdf = Entry(ORIGIN + "/file.pdf", "pdf", "linked_not_downloaded", ORIGIN, 1)
    assert review_flags(pdf) == [
        "editorial",
        "privacy",
        "copyright",
        "document_accessibility",
        "verify_document",
        "unresolved",
    ]
