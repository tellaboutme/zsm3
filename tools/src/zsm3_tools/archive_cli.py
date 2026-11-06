import argparse
import json
import sys
from collections.abc import Sequence
from pathlib import Path

from zsm3_tools.archive_discovery import DiscoveryError, discover
from zsm3_tools.archive_manifest import build, serialise
from zsm3_tools.archive_model import Settings
from zsm3_tools.archive_paths import ArchivePathError, output_root, source_root, write_atomic
from zsm3_tools.archive_permissions import PermissionsError, load_permissions
from zsm3_tools.archive_pipeline import Progress, Steps, process
from zsm3_tools.archive_report import markdown
from zsm3_tools.archive_store import Store
from zsm3_tools.archive_validate import validate

USAGE_ERROR = 2
PROGRESS_EVERY = 100
MAX_MANIFEST_BYTES = 200_000_000
MIN_QUALITY = 50
MAX_QUALITY = 100
DEFAULTS = Settings()


def _positive(value: str) -> int:
    number = int(value)
    if number < 1:
        message = "must be a positive integer"
        raise argparse.ArgumentTypeError(message)
    return number


def _quality(value: str) -> int:
    number = int(value)
    if not MIN_QUALITY <= number <= MAX_QUALITY:
        message = "must be between 50 and 100"
        raise argparse.ArgumentTypeError(message)
    return number


def parser() -> argparse.ArgumentParser:
    cli = argparse.ArgumentParser(
        prog="zsm3-gallery-archive",
        description="Dry run of the gallery archive import: nothing is uploaded or written to D1.",
        exit_on_error=False,
    )
    commands = cli.add_subparsers(dest="command", required=True)
    run = commands.add_parser("dry-run", exit_on_error=False)
    run.add_argument("--source", type=Path, required=True)
    run.add_argument("--out", type=Path, required=True)
    run.add_argument("--permissions", type=Path)
    run.add_argument("--label", default="local archive")
    run.add_argument("--resume", action="store_true")
    run.add_argument("--convert-unapproved", action="store_true")
    run.add_argument("--quality", type=_quality, default=DEFAULTS.quality)
    run.add_argument("--max-files", type=_positive, default=DEFAULTS.max_files)
    run.add_argument("--max-depth", type=_positive, default=DEFAULTS.max_depth)
    run.add_argument("--max-pixels", type=_positive, default=DEFAULTS.max_pixels)
    run.add_argument("--max-source-bytes", type=_positive, default=DEFAULTS.max_source_bytes)
    check = commands.add_parser("validate", exit_on_error=False)
    check.add_argument("--manifest", type=Path, required=True)
    check.add_argument("--variants", type=Path)
    return cli


def _progress(done: int, total: int) -> None:
    if done == total or done % PROGRESS_EVERY == 0:
        sys.stdout.write(f"processed {done}/{total} photos\n")


def dry_run(options: argparse.Namespace, progress: Progress = _progress) -> int:
    settings = Settings(
        options.quality,
        options.max_pixels,
        options.max_source_bytes,
        options.max_files,
        options.max_depth,
    )
    source = source_root(options.source)
    out = output_root(options.out, source, resume=options.resume)
    permissions = load_permissions(options.permissions)
    inventory = discover(source, settings)
    store = Store(out, settings)
    store.prepare()
    results = process(
        source,
        inventory,
        store,
        progress,
        Steps(
            may_convert=lambda photo: (
                options.convert_unapproved or permissions.is_approved(photo.path, photo.album)
            )
        ),
    )
    manifest = build(inventory, results, permissions, settings, options.label)
    problems = validate(manifest, store.variants)
    write_atomic(out / "manifest.json", serialise(manifest))
    write_atomic(out / "report.md", markdown(manifest, problems))
    summary = manifest["summary"]
    sys.stdout.write(f"dry run complete: {json.dumps(summary, sort_keys=True)}\n")
    return 1 if problems else 0


def check(options: argparse.Namespace) -> int:
    path: Path = options.manifest
    if path.stat().st_size > MAX_MANIFEST_BYTES:
        sys.stderr.write(f"error: {path} is too large\n")
        return 1
    try:
        manifest: object = json.loads(path.read_text(encoding="utf-8"))
    except (UnicodeDecodeError, json.JSONDecodeError):
        sys.stderr.write(f"error: {path} is not a JSON manifest\n")
        return 1
    problems = validate(manifest if isinstance(manifest, dict) else {}, options.variants)
    for problem in problems:
        sys.stdout.write(f"{problem}\n")
    sys.stdout.write(f"{len(problems)} problems\n")
    return 1 if problems else 0


def main(argv: Sequence[str] | None = None) -> int:
    try:
        options = parser().parse_args(argv)
    except (argparse.ArgumentError, SystemExit):
        return USAGE_ERROR
    try:
        return dry_run(options) if options.command == "dry-run" else check(options)
    except (ArchivePathError, DiscoveryError, PermissionsError, OSError) as error:
        sys.stderr.write(f"error: {error}\n")
        return 1
