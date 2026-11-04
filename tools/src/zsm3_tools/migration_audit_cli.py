import argparse
import sys
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from pathlib import Path

from zsm3_tools.migration_audit import Category, Evidence, LegacyEntry, audit
from zsm3_tools.migration_cms import cms_findings
from zsm3_tools.migration_inputs import (
    InputError,
    Rejected,
    read_inventory,
    read_map,
    read_paths,
    read_sitemap_paths,
    read_unresolved,
    read_url_list,
)
from zsm3_tools.migration_paths import is_redirectable
from zsm3_tools.migration_probe import (
    DEFAULT_DELAY_SECONDS,
    LocalProber,
    ProbeError,
    Prober,
    probe_all,
)
from zsm3_tools.migration_report import Report, candidates, manifest, markdown
from zsm3_tools.migration_routes import scan_routes

REPOSITORY = Path(__file__).resolve().parents[3]
DEFAULT_MAP = REPOSITORY / "tools" / "data" / "legacy-url-map.csv"
DEFAULT_UNRESOLVED = REPOSITORY / "tools" / "data" / "legacy-url-unresolved.csv"
DEFAULT_PAGES = REPOSITORY / "apps" / "web" / "src" / "pages"
OUTPUT_FILES = ("manifest.json", "report.md", "candidates.csv")
USAGE_ERROR = 2
INCOMPLETE_PROBE = 3

ProberFactory = Callable[[str], Prober]


class OutputError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class Sources:
    entries: list[LegacyEntry]
    redirects: dict[str, str]
    rejected: list[Rejected]


def parser() -> argparse.ArgumentParser:
    parse = argparse.ArgumentParser(prog="zsm3-migration-audit", exit_on_error=False)
    parse.add_argument("--inventory", type=Path, action="append", default=[])
    parse.add_argument("--urls", type=Path, action="append", default=[])
    parse.add_argument("--map", type=Path, default=DEFAULT_MAP)
    parse.add_argument("--unresolved", type=Path, default=DEFAULT_UNRESOLVED)
    parse.add_argument("--pages", type=Path, default=DEFAULT_PAGES)
    parse.add_argument("--cms-paths", type=Path)
    parse.add_argument("--sitemap", type=Path)
    parse.add_argument("--probe")
    parse.add_argument("--delay", type=float, default=DEFAULT_DELAY_SECONDS)
    parse.add_argument("--out-dir", type=Path, required=True)
    parse.add_argument("--overwrite", action="store_true")
    return parse


def check_output(directory: Path, *, overwrite: bool) -> None:
    resolved = directory.resolve()
    if resolved.is_relative_to(REPOSITORY):
        message = f"{directory}: write reports outside the repository; paths can hold names"
        raise OutputError(message)
    present = [name for name in OUTPUT_FILES if (resolved / name).exists()]
    if present and not overwrite:
        message = f"{directory}: {', '.join(present)} already present; pass --overwrite"
        raise OutputError(message)


def write_outputs(directory: Path, files: dict[str, bytes]) -> None:
    directory.mkdir(parents=True, exist_ok=True)
    for name, content in files.items():
        partial = directory / f".{name}.partial"
        partial.write_bytes(content)
        partial.replace(directory / name)


def load_sources(options: argparse.Namespace) -> Sources:
    entries: list[LegacyEntry] = []
    rejected: list[Rejected] = []
    for loaded in [*map(read_inventory, options.inventory), *map(read_url_list, options.urls)]:
        entries += loaded.items
        rejected += loaded.rejected
    mapped = read_map(options.map)
    return Sources(entries, mapped.items, [*rejected, *mapped.rejected])


def gather(options: argparse.Namespace, sources: Sources, factory: ProberFactory) -> Evidence:
    routes = scan_routes(options.pages)
    sitemap = None if options.sitemap is None else read_sitemap_paths(options.sitemap)
    if options.probe is None:
        return Evidence(routes, {}, sitemap)
    paths = {e.path.request_path for e in sources.entries if is_redirectable(e.path.request_path)}
    statuses = probe_all(
        factory(options.probe), paths | set(sources.redirects.values()), options.delay
    )
    return Evidence(routes, statuses, sitemap)


def run(options: argparse.Namespace, factory: ProberFactory) -> int:
    check_output(options.out_dir, overwrite=options.overwrite)
    sources = load_sources(options)
    evidence = gather(options, sources, factory)
    findings = audit(
        sources.entries, sources.redirects, read_unresolved(options.unresolved), evidence
    )
    cms = (
        []
        if options.cms_paths is None
        else cms_findings(evidence.routes, read_paths(options.cms_paths))
    )
    report = Report(findings, cms, sources.rejected)
    write_outputs(
        options.out_dir,
        {
            "manifest.json": manifest(report),
            "report.md": markdown(report),
            "candidates.csv": candidates(findings),
        },
    )
    sys.stdout.write(
        f"{len(findings)} legacy paths audited; reports written to {options.out_dir}\n"
    )
    failed = sum(finding.category is Category.PROBE_ERROR for finding in findings)
    if failed:
        sys.stderr.write(f"warning: the preview failed for {failed} paths; rerun the probe\n")
        return INCOMPLETE_PROBE
    return 0


def main(argv: Sequence[str] | None = None, factory: ProberFactory = LocalProber) -> int:
    try:
        options = parser().parse_args(argv)
    except (argparse.ArgumentError, SystemExit):
        return USAGE_ERROR
    if not options.inventory and not options.urls:
        sys.stderr.write("pass at least one --inventory or --urls source\n")
        return USAGE_ERROR
    try:
        return run(options, factory)
    except (InputError, OutputError, ProbeError, OSError) as error:
        sys.stderr.write(f"error: {error}\n")
        return 1
