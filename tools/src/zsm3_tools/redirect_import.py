import argparse
import json
import shutil
import subprocess
import sys
import tempfile
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

from zsm3_tools.redirect_paths import (
    RedirectRow,
    RedirectRowError,
    parse_redirect_row,
)
from zsm3_tools.redirect_sources import SourceError, SourceRow, read_rows

DATABASE = "DB"
USAGE_ERROR = 2
DEFAULT_TARGET = "/"
DEFAULT_SQL_OUT = "redirects-import.sql"
DEFAULT_PERSIST_TO = ".wrangler/state"
SELECT_EXISTING_PAIRS = "SELECT from_path, to_path FROM redirects"
DUPLICATE_REASON = "duplicate in batch"
NON_ASCII_WARNING = "holds non-ascii or percent characters and may never match a request"
ASCII_LIMIT = 127

Runner = Callable[[Sequence[str]], str]


class WranglerError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class Options:
    sources: tuple[Path, ...]
    target: str
    remote: bool
    yes: bool
    dry_run: bool
    update: bool
    sql_out: Path
    persist_to: str


@dataclass(frozen=True, slots=True)
class RejectedRow:
    origin: str
    raw_from: str
    raw_to: str
    reason: str


@dataclass(frozen=True, slots=True)
class ConflictRow:
    origin: str
    from_path: str
    db_to: str
    corpus_to: str


@dataclass(frozen=True, slots=True)
class ImportPlan:
    imported: tuple[RedirectRow, ...]
    updated: tuple[ConflictRow, ...]
    skipped: tuple[SourceRow, ...]
    conflicts: tuple[ConflictRow, ...]
    warnings: tuple[SourceRow, ...]
    rejected: tuple[RejectedRow, ...]


def parse_options(argv: Sequence[str]) -> Options:
    parser = argparse.ArgumentParser(
        prog="zsm3-import-legacy-urls",
        description="Import a batch of legacy URLs into the redirects D1 table.",
    )
    parser.add_argument("--source", action="append", type=Path, required=True)
    parser.add_argument("--to", default=DEFAULT_TARGET)
    parser.add_argument("--remote", action="store_true")
    parser.add_argument("--yes", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--update", action="store_true")
    parser.add_argument("--sql-out", type=Path, default=Path(DEFAULT_SQL_OUT))
    parser.add_argument("--persist-to", default=DEFAULT_PERSIST_TO)
    arguments = parser.parse_args(argv)
    return Options(
        sources=tuple(arguments.source),
        target=arguments.to,
        remote=arguments.remote,
        yes=arguments.yes,
        dry_run=arguments.dry_run,
        update=arguments.update,
        sql_out=arguments.sql_out,
        persist_to=arguments.persist_to,
    )


def _suspicious(value: str) -> bool:
    return any(ord(char) > ASCII_LIMIT for char in value) or "%" in value


def plan_import(
    rows: Sequence[SourceRow], existing: Mapping[str, str], *, update: bool
) -> ImportPlan:
    imported: list[RedirectRow] = []
    updated: list[ConflictRow] = []
    skipped: list[SourceRow] = []
    conflicts: list[ConflictRow] = []
    warnings: list[SourceRow] = []
    rejected: list[RejectedRow] = []
    seen: set[str] = set()
    for row in rows:
        try:
            redirect = parse_redirect_row(row.raw_from, row.raw_to)
        except RedirectRowError as error:
            rejected.append(RejectedRow(row.origin, row.raw_from, row.raw_to, str(error)))
            continue
        if redirect.from_path in seen:
            rejected.append(RejectedRow(row.origin, row.raw_from, row.raw_to, DUPLICATE_REASON))
            continue
        seen.add(redirect.from_path)
        stored = existing.get(redirect.from_path)
        if stored is None:
            imported.append(redirect)
        elif stored == redirect.to_path:
            skipped.append(row)
            continue
        elif update:
            updated.append(ConflictRow(row.origin, redirect.from_path, stored, redirect.to_path))
        else:
            conflicts.append(ConflictRow(row.origin, redirect.from_path, stored, redirect.to_path))
        if _suspicious(redirect.from_path):
            warnings.append(row)
    return ImportPlan(
        tuple(imported),
        tuple(updated),
        tuple(skipped),
        tuple(conflicts),
        tuple(warnings),
        tuple(rejected),
    )


def sql_string(value: str) -> str:
    escaped = value.replace("'", "''")
    return f"'{escaped}'"


def insert_statement(row: RedirectRow, created_at: str) -> str:
    values = f"{sql_string(row.from_path)}, {sql_string(row.to_path)}, {sql_string(created_at)}"
    return f"INSERT OR IGNORE INTO redirects (from_path, to_path, created_at) VALUES ({values});"


def upsert_statement(row: RedirectRow, created_at: str) -> str:
    values = f"{sql_string(row.from_path)}, {sql_string(row.to_path)}, {sql_string(created_at)}"
    return (
        f"INSERT INTO redirects (from_path, to_path, created_at) VALUES ({values}) "
        "ON CONFLICT (from_path) DO UPDATE SET to_path = excluded.to_path;"
    )


def import_sql(plan: ImportPlan, created_at: str) -> str:
    statements = [insert_statement(row, created_at) for row in plan.imported]
    statements += [
        upsert_statement(RedirectRow(conflict.from_path, conflict.corpus_to), created_at)
        for conflict in plan.updated
    ]
    return "".join(f"{statement}\n" for statement in statements)


def write_sql(path: Path, sql: str) -> None:
    path.write_bytes(sql.encode("utf-8"))


def utc_timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _results_of(parsed: object) -> object:
    if isinstance(parsed, list):
        if len(parsed) == 1:
            return _results_of(parsed[0])
        if parsed:
            message = "wrangler printed more than one statement result"
            raise WranglerError(message)
        return []
    if isinstance(parsed, dict):
        results: object = parsed.get("results", [])
        return results
    message = "wrangler printed an unexpected --json shape"
    raise WranglerError(message)


def parse_existing_pairs(payload: str) -> dict[str, str]:
    try:
        parsed: object = json.loads(payload)
    except ValueError as error:
        message = f"wrangler printed invalid JSON: {error}"
        raise WranglerError(message) from error
    rows = _results_of(parsed)
    if not isinstance(rows, list):
        message = "wrangler printed an unexpected results list"
        raise WranglerError(message)
    pairs: dict[str, str] = {}
    for row in rows:
        if isinstance(row, dict):
            source = row.get("from_path")
            target = row.get("to_path")
            if isinstance(source, str) and isinstance(target, str):
                pairs[source] = target
    return pairs


def scope_flags(options: Options) -> list[str]:
    if options.remote:
        return ["--remote", "--yes"]
    return ["--local", "--persist-to", options.persist_to]


def wrangler_prefix() -> list[str]:
    pnpm = shutil.which("pnpm")
    if pnpm is None:
        message = "pnpm is required to run wrangler"
        raise WranglerError(message)
    return [pnpm, "--filter", "@zsm3/web", "exec", "wrangler", "d1", "execute", DATABASE]


def run_wrangler(command: Sequence[str]) -> str:
    completed = subprocess.run(list(command), capture_output=True, encoding="utf-8", check=False)
    if completed.returncode != 0:
        message = completed.stderr.strip() or f"wrangler exited with {completed.returncode}"
        raise WranglerError(message)
    return completed.stdout


def existing_pairs(execute: Runner, prefix: Sequence[str], options: Options) -> dict[str, str]:
    command = [*prefix, *scope_flags(options), "--json", "--command", SELECT_EXISTING_PAIRS]
    return parse_existing_pairs(execute(command))


def execute_import(execute: Runner, prefix: Sequence[str], options: Options, sql: str) -> None:
    with tempfile.NamedTemporaryFile(
        "w", encoding="utf-8", newline="\n", suffix=".sql", delete=False
    ) as handle:
        handle.write(sql)
        temporary = Path(handle.name)
    try:
        execute([*prefix, *scope_flags(options), "--file", str(temporary)])
    finally:
        temporary.unlink()


def report(plan: ImportPlan) -> None:
    for row in plan.skipped:
        sys.stdout.write(f"skip {row.raw_from} at {row.origin}: already present\n")
    for conflict in plan.conflicts:
        sys.stdout.write(
            f"conflict {conflict.origin}: db {conflict.db_to!r} != corpus {conflict.corpus_to!r}\n"
        )
    for conflict in plan.updated:
        sys.stdout.write(
            f"update {conflict.origin}: db {conflict.db_to!r} -> corpus {conflict.corpus_to!r}\n"
        )
    for row in plan.warnings:
        sys.stdout.write(f"warn {row.origin}: {row.raw_from!r} {NON_ASCII_WARNING}\n")
    for problem in plan.rejected:
        sys.stdout.write(
            f"reject {problem.origin}: {problem.raw_from!r} -> {problem.raw_to!r}: "
            f"{problem.reason}\n"
        )
    sys.stdout.write(
        f"imported {len(plan.imported)}, updated {len(plan.updated)}, "
        f"skipped {len(plan.skipped)}, conflicts {len(plan.conflicts)}, "
        f"rejected {len(plan.rejected)}, warnings {len(plan.warnings)}\n"
    )


def main(argv: Sequence[str] | None = None, runner: Runner | None = None) -> int:
    options = parse_options(sys.argv[1:] if argv is None else argv)
    if options.remote and not options.yes:
        sys.stderr.write("--remote requires --yes to confirm the production database\n")
        return USAGE_ERROR
    execute = run_wrangler if runner is None else runner
    try:
        rows = [row for source in options.sources for row in read_rows(source, options.target)]
        prefix = wrangler_prefix()
        existing = existing_pairs(execute, prefix, options)
        plan = plan_import(rows, existing, update=options.update)
        created_at = utc_timestamp()
        if options.dry_run:
            write_sql(options.sql_out, import_sql(plan, created_at))
        elif plan.imported or plan.updated:
            execute_import(execute, prefix, options, import_sql(plan, created_at))
    except (SourceError, WranglerError) as error:
        sys.stderr.write(f"{error}\n")
        return 1
    report(plan)
    return 1 if plan.rejected or plan.conflicts else 0
