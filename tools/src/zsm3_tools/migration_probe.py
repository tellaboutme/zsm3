import http.client
import time
from collections.abc import Callable, Iterable
from typing import Protocol
from urllib.parse import urlsplit

LOOPBACK_HOSTS = frozenset({"127.0.0.1", "localhost", "[::1]"})
PROBE_TIMEOUT_SECONDS = 10
MAX_PROBES = 5000
DEFAULT_DELAY_SECONDS = 0.05
AGENT = "ZSM3MigrationAudit/1.0"
SLASH_REDIRECTS = frozenset({301, 308})


class ProbeError(ValueError):
    pass


class Prober(Protocol):
    def status(self, path: str) -> int: ...


def loopback_origin(value: str) -> tuple[str, int]:
    parsed = urlsplit(value)
    host = parsed.netloc.rsplit(":", 1)[0] if parsed.port is not None else parsed.netloc
    if (
        parsed.scheme != "http"
        or host not in LOOPBACK_HOSTS
        or parsed.path not in {"", "/"}
        or parsed.query != ""
        or parsed.username is not None
    ):
        message = "the probe only reaches a local preview, such as http://127.0.0.1:8787"
        raise ProbeError(message)
    return parsed.hostname or host, parsed.port or 80


class LocalProber:
    def __init__(self, origin: str) -> None:
        self._host, self._port = loopback_origin(origin)

    def _request(self, path: str) -> tuple[int, str | None]:
        connection = http.client.HTTPConnection(
            self._host, self._port, timeout=PROBE_TIMEOUT_SECONDS
        )
        try:
            connection.request("GET", path, headers={"User-Agent": AGENT})
            response = connection.getresponse()
            response.close()
            return response.status, response.getheader("Location")
        finally:
            connection.close()

    def status(self, path: str) -> int:
        status, location = self._request(path)
        if status in SLASH_REDIRECTS and path != "/" and location == path.removesuffix("/"):
            return self._request(location)[0]
        return status


def probe_all(
    prober: Prober,
    paths: Iterable[str],
    delay: float = DEFAULT_DELAY_SECONDS,
    sleep: Callable[[float], None] = time.sleep,
) -> dict[str, int]:
    ordered = sorted(set(paths))
    if len(ordered) > MAX_PROBES:
        message = f"refusing to probe more than {MAX_PROBES} paths"
        raise ProbeError(message)
    statuses: dict[str, int] = {}
    for index, path in enumerate(ordered):
        if index:
            sleep(delay)
        try:
            statuses[path] = prober.status(path)
        except (OSError, http.client.HTTPException) as error:
            message = f"probe of {path} failed: {error}"
            raise ProbeError(message) from error
    return statuses
