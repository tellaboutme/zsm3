import argparse
import http.client
import json
import math
import sys
import time
from collections import deque
from collections.abc import Callable, Sequence
from dataclasses import asdict, dataclass
from html.parser import HTMLParser
from pathlib import Path
from typing import override
from urllib.parse import urlsplit

from zsm3_tools.inventory_http import (
    AGENT,
    HTTP_OK,
    ORIGIN,
    HttpTransport,
    InventoryError,
    Response,
    Transport,
    canonical_url,
    is_html_path,
    is_pdf_path,
)
from zsm3_tools.inventory_robots import RobotsRules, parse_rules

MAX_HTML_BYTES = 1_000_000
MAX_PAGE_BYTES_CEILING = 8_000_000
MAX_ROBOTS_BYTES = 100_000
MAX_PAGES = 1000
MAX_DEPTH = 5
MAX_DISCOVERED = 10_000
TRANSPORT_ERRORS = (OSError, http.client.HTTPException, InventoryError)


class LinkParser(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.links: list[str] = []

    @override
    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag == "a":
            href = dict(attrs).get("href")
            if href is not None:
                self.links.append(href)


@dataclass(frozen=True, slots=True)
class Entry:
    url: str
    kind: str
    status: str
    discovered_from: str | None
    depth: int


def review_flags(entry: Entry) -> list[str]:
    flags = ["editorial", "privacy"]
    if entry.kind == "pdf":
        flags.extend(("copyright", "document_accessibility", "verify_document"))
    if entry.status != "discovered":
        flags.append("unresolved")
    return flags


@dataclass(frozen=True, slots=True)
class Limits:
    pages: int = 100
    depth: int = 2
    delay: float = 1.0
    page_bytes: int = MAX_HTML_BYTES


DEFAULT_LIMITS = Limits()


def _robots(transport: Transport) -> RobotsRules:
    unavailable = "robots.txt unavailable; crawl stopped"
    try:
        response = transport.get(ORIGIN + "/robots.txt", MAX_ROBOTS_BYTES)
    except TRANSPORT_ERRORS as error:
        raise InventoryError(unavailable) from error
    if (
        response.status != HTTP_OK
        or response.content_type != "text/plain"
        or len(response.body) > MAX_ROBOTS_BYTES
    ):
        raise InventoryError(unavailable)
    try:
        return parse_rules(response.body.decode("utf-8-sig"))
    except ValueError as error:
        message = "robots.txt invalid; crawl stopped"
        raise InventoryError(message) from error


def _links(response: Response, url: str) -> list[str]:
    parser = LinkParser()
    parser.feed(response.body.decode("utf-8", errors="replace"))
    linked = [canonical_url(href, url) for href in parser.links]
    return [
        candidate
        for candidate in linked
        if candidate is not None
        and (is_pdf_path(urlsplit(candidate).path) or is_html_path(urlsplit(candidate).path))
    ]


def _fetch(url: str, transport: Transport, page_bytes: int) -> tuple[str, list[str]]:
    try:
        response = transport.get(url, page_bytes)
    except TRANSPORT_ERRORS as error:
        return "fetch_error:" + type(error).__name__, []
    if response.status != HTTP_OK:
        return f"http_{response.status}", []
    if response.content_type != "text/html" or len(response.body) > page_bytes:
        return "not_html_or_too_large", []
    return "discovered", _links(response, url)


def _check_limits(limits: Limits) -> None:
    if (
        not 1 <= limits.pages <= MAX_PAGES
        or not 0 <= limits.depth <= MAX_DEPTH
        or not math.isfinite(limits.delay)
        or limits.delay < 1
        or not MAX_HTML_BYTES <= limits.page_bytes <= MAX_PAGE_BYTES_CEILING
    ):
        message = "limits require 1-1000 pages, depth 0-5, delay >= 1 second and 1-8 MB per page"
        raise InventoryError(message)


def inventory(
    seeds: Sequence[str],
    transport: Transport,
    *,
    limits: Limits = DEFAULT_LIMITS,
    pause: Callable[[float], None] = time.sleep,
) -> list[Entry]:
    _check_limits(limits)
    queue: deque[tuple[str, str | None, int]] = deque()
    queue.extend((_seed(seed), None, 0) for seed in seeds)
    policy = _robots(transport)
    interval = max(limits.delay, policy.delay)
    seen: set[str] = set()
    entries: list[Entry] = []
    fetched = 0
    while queue:
        url, source, depth = queue.popleft()
        if url in seen:
            continue
        seen.add(url)
        kind = "pdf" if is_pdf_path(urlsplit(url).path) else "html"
        if not policy.can_fetch(AGENT, url):
            entries.append(Entry(url, kind, "robots_denied", source, depth))
            continue
        if kind == "pdf":
            entries.append(Entry(url, kind, "linked_not_downloaded", source, depth))
            continue
        if depth > limits.depth or fetched >= limits.pages:
            entries.append(Entry(url, kind, "limit_not_fetched", source, depth))
            continue
        pause(interval)
        fetched += 1
        status, links = _fetch(url, transport, limits.page_bytes)
        for linked in links:
            if linked not in seen:
                if len(queue) + len(seen) >= MAX_DISCOVERED:
                    status = "discovery_limit"
                    break
                queue.append((linked, url, depth + 1))
        entries.append(Entry(url, kind, status, source, depth))
    return entries


def _seed(seed: str) -> str:
    normalized = canonical_url(seed)
    if normalized is None:
        message = f"seed {seed!r} must be a page on {ORIGIN}"
        raise InventoryError(message)
    if not is_html_path(urlsplit(normalized).path):
        message = f"seed {seed!r} must be an HTML page, not a document or asset"
        raise InventoryError(message)
    return normalized


def render(entries: Sequence[Entry]) -> bytes:
    rows = [{**asdict(entry), "review_flags": review_flags(entry)} for entry in entries]
    return (json.dumps(rows, ensure_ascii=False, indent=2) + "\n").encode()


def main(
    argv: Sequence[str] | None = None,
    transport: Transport | None = None,
    pause: Callable[[float], None] = time.sleep,
) -> int:
    cli = argparse.ArgumentParser(description="Bounded, robots-aware public link inventory")
    cli.add_argument("output", type=Path)
    cli.add_argument("--seed", action="append", default=[])
    cli.add_argument("--max-pages", type=int, default=DEFAULT_LIMITS.pages)
    cli.add_argument("--max-depth", type=int, default=DEFAULT_LIMITS.depth)
    cli.add_argument("--delay", type=float, default=DEFAULT_LIMITS.delay)
    cli.add_argument("--max-page-bytes", type=int, default=DEFAULT_LIMITS.page_bytes)
    args = cli.parse_args(sys.argv[1:] if argv is None else argv)
    try:
        entries = inventory(
            [ORIGIN + "/", *args.seed],
            HttpTransport() if transport is None else transport,
            limits=Limits(args.max_pages, args.max_depth, args.delay, args.max_page_bytes),
            pause=pause,
        )
        args.output.write_bytes(render(entries))
    except InventoryError as error:
        sys.stderr.write(f"{error}\n")
        return 1
    except OSError as error:
        sys.stderr.write(f"cannot write {args.output}: {error.strerror}\n")
        return 1
    return 0
