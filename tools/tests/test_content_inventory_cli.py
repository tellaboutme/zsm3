import http.client
import json
import ssl
import sys
from dataclasses import dataclass, field
from pathlib import Path
from unittest.mock import Mock

import pytest

from zsm3_tools import content_inventory
from zsm3_tools.content_inventory import inventory
from zsm3_tools.inventory_http import (
    HOST,
    ORIGIN,
    HttpTransport,
    InventoryError,
    Response,
    canonical_url,
)

ROBOTS = ORIGIN + "/robots.txt"


@dataclass
class ScriptedTransport:
    responses: dict[str, Response | Exception]
    requests: list[str] = field(default_factory=list)

    def get(self, url: str, _max_bytes: int) -> Response:
        self.requests.append(url)
        outcome = self.responses[url]
        if isinstance(outcome, Exception):
            raise outcome
        return outcome


def allow_all(pages: dict[str, Response | Exception]) -> ScriptedTransport:
    return ScriptedTransport({ROBOTS: Response(200, "text/plain", b"User-agent: *"), **pages})


def no_wait(_seconds: float) -> None:
    pass


def test_bare_origin_and_non_ascii_paths_are_canonical() -> None:
    assert canonical_url(ORIGIN) == ORIGIN + "/"
    assert canonical_url("/zajęcia pozalekcyjne") == ORIGIN + "/zaj%C4%99cia%20pozalekcyjne"
    assert canonical_url("/zaj%C4%99cia%20pozalekcyjne") == canonical_url("/zajęcia pozalekcyjne")
    assert canonical_url("/WP-ADMIN/") is None
    assert canonical_url("/%77p-admin/") is None


@pytest.mark.parametrize(
    "path", ["/a/%2e%2e/wp-admin/", "/a/.%2E/wp-login.php", "/x/%2e/page", "/a/%2E%2E"]
)
def test_encoded_dot_segments_are_rejected(path: str) -> None:
    assert canonical_url(path) is None


def test_protocol_errors_are_recorded_not_fatal() -> None:
    transport = allow_all({ORIGIN + "/": http.client.IncompleteRead(b"")})
    entries = inventory([ORIGIN + "/"], transport, pause=no_wait)
    assert entries[0].status == "fetch_error:IncompleteRead"


def test_robots_protocol_error_stops_the_crawl() -> None:
    transport = ScriptedTransport({ROBOTS: http.client.BadStatusLine("")})
    with pytest.raises(InventoryError, match=r"robots\.txt unavailable"):
        inventory([ORIGIN + "/"], transport)


def test_cli_writes_deterministic_lf_json(tmp_path: Path) -> None:
    output = tmp_path / "inventory.json"
    page = ORIGIN + "/szkola"
    transport = allow_all(
        {
            ORIGIN + "/": Response(200, "text/html", b'<a href="/statut.pdf">Statut</a>'),
            page: Response(404, "text/html", b""),
        }
    )
    assert content_inventory.main([str(output), "--seed", page], transport, no_wait) == 0
    first = output.read_bytes()
    assert b"\r" not in first
    assert transport.requests == [ROBOTS, ORIGIN + "/", page]
    assert json.loads(first) == [
        {
            "url": ORIGIN + "/",
            "kind": "html",
            "status": "discovered",
            "discovered_from": None,
            "depth": 0,
            "review_flags": ["editorial", "privacy"],
        },
        {
            "url": page,
            "kind": "html",
            "status": "http_404",
            "discovered_from": None,
            "depth": 0,
            "review_flags": ["editorial", "privacy", "unresolved"],
        },
        {
            "url": ORIGIN + "/statut.pdf",
            "kind": "pdf",
            "status": "linked_not_downloaded",
            "discovered_from": ORIGIN + "/",
            "depth": 1,
            "review_flags": [
                "editorial",
                "privacy",
                "copyright",
                "document_accessibility",
                "verify_document",
                "unresolved",
            ],
        },
    ]
    assert content_inventory.main([str(output), "--seed", page], transport, no_wait) == 0
    assert output.read_bytes() == first


def test_cli_rejects_foreign_seed_before_any_request(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    output = tmp_path / "inventory.json"
    transport = allow_all({})
    assert (
        content_inventory.main([str(output), "--seed", "https://example.com/"], transport, no_wait)
        == 1
    )
    assert "'https://example.com/' must be a page on " + ORIGIN in capsys.readouterr().err
    assert transport.requests == []
    assert not output.exists()


def test_cli_reports_invalid_limits(capsys: pytest.CaptureFixture[str], tmp_path: Path) -> None:
    arguments = [str(tmp_path / "out.json"), "--delay", "0.5"]
    assert content_inventory.main(arguments, allow_all({})) == 1
    assert "delay >= 1 second" in capsys.readouterr().err
    arguments = [str(tmp_path / "out.json"), "--max-page-bytes", "9000000"]
    assert content_inventory.main(arguments, allow_all({})) == 1
    assert "1-8 MB per page" in capsys.readouterr().err


def test_cli_reports_unwritable_output(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    transport = allow_all({ORIGIN + "/": Response(200, "text/html", b"")})
    assert content_inventory.main([str(tmp_path / "missing" / "out.json")], transport, no_wait) == 1
    assert "cannot write" in capsys.readouterr().err


def test_cli_defaults_to_network_transport(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    created: list[str] = []

    class OfflineTransport:
        def __init__(self) -> None:
            created.append("http")

        def get(self, _url: str, _max_bytes: int) -> Response:
            message = "offline"
            raise OSError(message)

    monkeypatch.setattr(content_inventory, "HttpTransport", OfflineTransport)
    monkeypatch.setattr(sys, "argv", ["inventory", str(tmp_path / "o.json")])
    assert content_inventory.main() == 1
    assert created == ["http"]


def test_network_transport_verifies_certificates_and_host(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    created: list[tuple[tuple[object, ...], dict[str, object]]] = []
    connection = Mock()
    connection.request.side_effect = OSError("offline")

    def connect(*args: object, **kwargs: object) -> Mock:
        created.append((args, kwargs))
        return connection

    monkeypatch.setattr(http.client, "HTTPSConnection", connect)
    with pytest.raises(OSError, match="offline"):
        HttpTransport().get(ORIGIN + "/", 1)

    [(args, kwargs)] = created
    context = kwargs["context"]
    assert args == (HOST,)
    assert isinstance(context, ssl.SSLContext)
    assert context.verify_mode == ssl.CERT_REQUIRED
    assert context.check_hostname
    assert context.minimum_version >= ssl.TLSVersion.TLSv1_2
