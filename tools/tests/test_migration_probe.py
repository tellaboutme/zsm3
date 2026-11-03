import http.client
import threading
from collections.abc import Iterator
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from typing import override

import pytest

from zsm3_tools import migration_probe
from zsm3_tools.migration_probe import LocalProber, ProbeError, loopback_origin, probe_all

ROUTES = {"/kontakt": 200, "/stara": 301}


class Handler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        status = ROUTES.get(self.path, 404)
        self.send_response(status)
        if status == 301:
            self.send_header("Location", "/nowa")
        self.send_header("Content-Length", "2")
        self.end_headers()
        self.wfile.write(b"ok")

    @override
    def log_message(self, format: str, *args: object) -> None:
        return


@pytest.fixture
def preview() -> Iterator[str]:
    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_address[1]}"
    finally:
        server.shutdown()
        server.server_close()


@pytest.mark.parametrize(
    ("origin", "expected"),
    [
        ("http://127.0.0.1:8787", ("127.0.0.1", 8787)),
        ("http://localhost/", ("localhost", 80)),
        ("http://[::1]:8787", ("::1", 8787)),
    ],
)
def test_only_a_loopback_preview_is_accepted(origin: str, expected: tuple[str, int]) -> None:
    assert loopback_origin(origin) == expected


@pytest.mark.parametrize(
    "origin",
    [
        "https://127.0.0.1:8787",
        "http://www.example.edu.pl",
        "http://127.0.0.1.example.com",
        "http://127.0.0.1:8787/sciezka",
        "http://127.0.0.1:8787?x=1",
        "http://user@127.0.0.1:8787",
    ],
)
def test_anything_else_is_refused(origin: str) -> None:
    with pytest.raises(ProbeError, match="local preview"):
        loopback_origin(origin)


def test_statuses_are_read_without_following_redirects(preview: str) -> None:
    prober = LocalProber(preview)

    assert prober.status("/kontakt") == 200
    assert prober.status("/stara") == 301
    assert prober.status("/brak") == 404


class Recorder:
    def __init__(self, failing: str = "") -> None:
        self.seen: list[str] = []
        self.failing = failing

    def status(self, path: str) -> int:
        self.seen.append(path)
        if path == self.failing:
            raise http.client.RemoteDisconnected(path)
        return 200


def test_paths_are_probed_once_in_order_with_a_pause_between_them() -> None:
    prober = Recorder()
    pauses: list[float] = []

    statuses = probe_all(prober, ["/b", "/a", "/b"], 0.5, pauses.append)

    assert statuses == {"/a": 200, "/b": 200}
    assert prober.seen == ["/a", "/b"]
    assert pauses == [0.5]


def test_failures_and_oversized_batches_stop_the_probe(monkeypatch: pytest.MonkeyPatch) -> None:
    with pytest.raises(ProbeError, match="probe of /b failed"):
        probe_all(Recorder("/b"), ["/a", "/b"], 0, lambda _: None)
    monkeypatch.setattr(migration_probe, "MAX_PROBES", 1)
    with pytest.raises(ProbeError, match="more than 1 paths"):
        probe_all(Recorder(), ["/a", "/b"], 0, lambda _: None)
