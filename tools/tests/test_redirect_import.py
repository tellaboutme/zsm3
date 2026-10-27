import json
import sqlite3
import sys
from collections.abc import Sequence
from dataclasses import replace
from pathlib import Path

import pytest

from zsm3_tools.redirect_import import (
    DUPLICATE_REASON,
    USAGE_ERROR,
    ConflictRow,
    ImportPlan,
    Options,
    RejectedRow,
    WranglerError,
    execute_import,
    existing_pairs,
    import_sql,
    insert_statement,
    main,
    parse_existing_pairs,
    parse_options,
    plan_import,
    report,
    run_wrangler,
    scope_flags,
    sql_string,
    upsert_statement,
    utc_timestamp,
    wrangler_prefix,
    write_sql,
)
from zsm3_tools.redirect_paths import RedirectRow
from zsm3_tools.redirect_sources import SourceRow

INSERT_PREFIX = "INSERT OR IGNORE INTO redirects (from_path, to_path, created_at) VALUES "

BASE_OPTIONS = Options(
    sources=(Path("legacy.csv"),),
    target=None,
    remote=False,
    yes=False,
    dry_run=False,
    update=False,
    sql_out=Path("redirects-import.sql"),
    persist_to=".wrangler/state",
)


class RecordingRunner:
    def __init__(self, payload: str) -> None:
        self.payload = payload
        self.commands: list[list[str]] = []
        self.files: list[str] = []

    def __call__(self, command: Sequence[str]) -> str:
        self.commands.append(list(command))
        if "--file" in command:
            path = Path(command[command.index("--file") + 1])
            self.files.append(path.read_text(encoding="utf-8"))
        return self.payload


@pytest.fixture
def fake_pnpm(monkeypatch: pytest.MonkeyPatch) -> None:
    def fake_which(_name: str) -> str | None:
        return "pnpm-is-here"

    monkeypatch.setattr("zsm3_tools.redirect_import.shutil.which", fake_which)


def csv_source(tmp_path: Path, rows: str) -> Path:
    path = tmp_path / "legacy.csv"
    path.write_text(f"from_path,to_path\n{rows}", encoding="utf-8")
    return path


def test_plan_imports_new_rows_in_order() -> None:
    plan = plan_import(
        [SourceRow("/A/", "/b", "a.csv:2"), SourceRow("/c", "/d", "a.csv:3")], {}, update=False
    )

    assert plan.imported == (RedirectRow("/a", "/b"), RedirectRow("/c", "/d"))
    assert plan.updated == ()
    assert plan.skipped == ()
    assert plan.conflicts == ()
    assert plan.warnings == ()
    assert plan.rejected == ()


def test_plan_skips_rows_identical_to_the_database() -> None:
    row = SourceRow("/A/", "/b", "a.csv:2")

    plan = plan_import([row], {"/a": "/b"}, update=False)

    assert plan.imported == ()
    assert plan.skipped == (row,)
    assert plan.conflicts == ()


def test_plan_reports_conflicts_without_update() -> None:
    row = SourceRow("/a", "/b", "a.csv:2")

    plan = plan_import([row], {"/a": "/c"}, update=False)

    assert plan.imported == ()
    assert plan.skipped == ()
    assert plan.conflicts == (ConflictRow("a.csv:2", "/a", "/c", "/b"),)
    assert plan.updated == ()


def test_plan_upserts_conflicts_with_update() -> None:
    row = SourceRow("/a", "/b", "a.csv:2")

    plan = plan_import([row], {"/a": "/c"}, update=True)

    assert plan.imported == ()
    assert plan.skipped == ()
    assert plan.conflicts == ()
    assert plan.updated == (ConflictRow("a.csv:2", "/a", "/c", "/b"),)


def test_plan_rejects_a_duplicate_of_an_existing_row() -> None:
    first = SourceRow("/a", "/b", "a.csv:2")
    second = SourceRow("/A", "/c", "a.csv:3")

    plan = plan_import([first, second], {"/a": "/b"}, update=False)

    assert plan.skipped == (first,)
    assert [(row.origin, row.reason) for row in plan.rejected] == [("a.csv:3", DUPLICATE_REASON)]


def test_plan_rejects_in_batch_duplicates_after_the_first() -> None:
    plan = plan_import(
        [SourceRow("/a", "/b", "a.csv:2"), SourceRow("/A", "/c", "a.csv:3")], {}, update=False
    )

    assert plan.imported == (RedirectRow("/a", "/b"),)
    assert [(row.origin, row.reason) for row in plan.rejected] == [("a.csv:3", DUPLICATE_REASON)]


def test_plan_rejects_invalid_rows() -> None:
    plan = plan_import([SourceRow("nope", "/b", "a.csv:2")], {}, update=False)

    assert plan.imported == ()
    assert [(row.origin, row.reason) for row in plan.rejected] == [
        ("a.csv:2", "from path must start with /")
    ]


def test_plan_warns_about_non_ascii_source_paths() -> None:
    row = SourceRow("/ścieżka", "/a", "sitemap.xml#3")

    plan = plan_import([row], {}, update=False)

    assert plan.imported == (RedirectRow("/ścieżka", "/a"),)
    assert plan.warnings == (row,)


def test_plan_warns_about_percent_characters() -> None:
    row = SourceRow("/a%b", "/a", "a.csv:2")

    plan = plan_import([row], {}, update=False)

    assert plan.warnings == (row,)


def test_plan_warns_about_updated_conflicts_too() -> None:
    row = SourceRow("/ząb", "/b", "a.csv:2")

    plan = plan_import([row], {"/ząb": "/c"}, update=True)

    assert plan.updated == (ConflictRow("a.csv:2", "/ząb", "/c", "/b"),)
    assert plan.warnings == (row,)


def test_plan_stays_quiet_about_clean_and_skipped_rows() -> None:
    plan = plan_import(
        [SourceRow("/a", "/b", "a.csv:2"), SourceRow("/c", "/d", "a.csv:3")],
        {"/c": "/d"},
        update=False,
    )

    assert plan.warnings == ()


def test_insert_statement_escapes_apostrophes() -> None:
    statement = insert_statement(RedirectRow("/o'neil", "/a"), "T")

    assert statement == f"{INSERT_PREFIX}('/o''neil', '/a', 'T');"


def test_upsert_statement_matches_the_repository_shape() -> None:
    statement = upsert_statement(RedirectRow("/a", "/b"), "T")

    assert statement == (
        "INSERT INTO redirects (from_path, to_path, created_at) VALUES ('/a', '/b', 'T') "
        "ON CONFLICT (from_path) DO UPDATE SET to_path = excluded.to_path;"
    )


def test_sql_string_doubles_apostrophes() -> None:
    assert sql_string("x'y") == "'x''y'"


def test_import_sql_joins_inserts_and_upserts() -> None:
    plan = ImportPlan(
        imported=(RedirectRow("/a", "/b"),),
        updated=(ConflictRow("a.csv:3", "/c", "/old", "/d"),),
        skipped=(),
        conflicts=(),
        warnings=(),
        rejected=(),
    )

    sql = import_sql(plan, "T")

    assert sql == (
        f"{INSERT_PREFIX}('/a', '/b', 'T');\n"
        "INSERT INTO redirects (from_path, to_path, created_at) VALUES ('/c', '/d', 'T') "
        "ON CONFLICT (from_path) DO UPDATE SET to_path = excluded.to_path;\n"
    )


def test_import_sql_runs_on_sqlite_with_the_table_checks() -> None:
    connection = sqlite3.connect(":memory:")
    connection.execute(
        "CREATE TABLE redirects ("
        "from_path TEXT PRIMARY KEY CHECK (from_path GLOB '/*'), "
        "to_path TEXT NOT NULL CHECK (to_path GLOB '/*' AND to_path <> from_path), "
        "created_at TEXT NOT NULL)"
    )
    plan = ImportPlan(
        imported=(RedirectRow("/o'neil", "/a"), RedirectRow("/b", "/c")),
        updated=(ConflictRow("a.csv:3", "/b", "/old", "/d"),),
        skipped=(),
        conflicts=(),
        warnings=(),
        rejected=(),
    )

    connection.executescript(import_sql(plan, "T"))
    rows = connection.execute(
        "SELECT from_path, to_path, created_at FROM redirects ORDER BY from_path"
    ).fetchall()
    connection.close()

    assert rows == [("/b", "/d", "T"), ("/o'neil", "/a", "T")]


def test_write_sql_writes_lf_bytes(tmp_path: Path) -> None:
    target = tmp_path / "plan.sql"

    write_sql(target, "A;\nB;\n")

    assert target.read_bytes() == b"A;\nB;\n"


def test_utc_timestamp_matches_the_worker_format() -> None:
    stamp = utc_timestamp()

    assert len(stamp) == 24
    assert stamp.endswith("Z")
    assert stamp[10] == "T"


def test_parse_existing_pairs_reads_the_object_shape() -> None:
    payload = json.dumps(
        {
            "results": [
                {"from_path": "/a", "to_path": "/b"},
                {"other": 1},
                {"from_path": "/c", "to_path": "/d"},
            ]
        }
    )

    assert parse_existing_pairs(payload) == {"/a": "/b", "/c": "/d"}


def test_parse_existing_pairs_reads_the_list_shape() -> None:
    payload = json.dumps([{"results": [{"from_path": "/a", "to_path": "/b"}]}])

    assert parse_existing_pairs(payload) == {"/a": "/b"}


def test_parse_existing_pairs_accepts_empty_results() -> None:
    assert parse_existing_pairs(json.dumps({"results": []})) == {}
    assert parse_existing_pairs("[]") == {}


def test_parse_existing_pairs_ignores_incomplete_rows() -> None:
    payload = json.dumps({"results": ["/not-a-row", {"from_path": "/a"}]})

    assert parse_existing_pairs(payload) == {}


def test_parse_existing_pairs_rejects_invalid_json() -> None:
    with pytest.raises(WranglerError, match="invalid JSON"):
        parse_existing_pairs("nope")


def test_parse_existing_pairs_rejects_multiple_statement_results() -> None:
    payload = json.dumps([{"results": []}, {"results": []}])

    with pytest.raises(WranglerError, match="more than one"):
        parse_existing_pairs(payload)


def test_parse_existing_pairs_rejects_unknown_shapes() -> None:
    with pytest.raises(WranglerError, match="unexpected --json shape"):
        parse_existing_pairs("42")

    with pytest.raises(WranglerError, match="unexpected results list"):
        parse_existing_pairs(json.dumps({"results": 5}))


def test_local_scope_flags_use_the_local_state() -> None:
    assert scope_flags(BASE_OPTIONS) == ["--local", "--persist-to", ".wrangler/state"]


def test_remote_scope_flags_confirm_to_wrangler() -> None:
    confirmed = replace(BASE_OPTIONS, remote=True, yes=True)

    assert scope_flags(confirmed) == ["--remote", "--yes"]


@pytest.mark.usefixtures("fake_pnpm")
def test_wrangler_prefix_runs_through_the_web_package() -> None:
    assert wrangler_prefix() == [
        "pnpm-is-here",
        "--filter",
        "@zsm3/web",
        "exec",
        "wrangler",
        "d1",
        "execute",
        "DB",
    ]


def test_wrangler_prefix_requires_pnpm(monkeypatch: pytest.MonkeyPatch) -> None:
    def no_which(_name: str) -> str | None:
        return None

    monkeypatch.setattr("zsm3_tools.redirect_import.shutil.which", no_which)

    with pytest.raises(WranglerError, match="pnpm is required"):
        wrangler_prefix()


def test_run_wrangler_returns_stdout() -> None:
    assert run_wrangler([sys.executable, "-c", "print('ok')"]) == "ok\n"


def test_run_wrangler_raises_with_stderr() -> None:
    with pytest.raises(WranglerError, match="boom"):
        run_wrangler(
            [sys.executable, "-c", "import sys; sys.stderr.write('boom'); raise SystemExit(3)"]
        )


def test_run_wrangler_reports_the_exit_code_without_stderr() -> None:
    with pytest.raises(WranglerError, match="exited with 3"):
        run_wrangler([sys.executable, "-c", "raise SystemExit(3)"])


def test_existing_pairs_queries_the_selected_scope() -> None:
    runner = RecordingRunner(json.dumps({"results": [{"from_path": "/a", "to_path": "/b"}]}))
    local = replace(BASE_OPTIONS, persist_to="state")

    assert existing_pairs(runner, ["wrangler"], local) == {"/a": "/b"}
    assert runner.commands == [
        [
            "wrangler",
            "--local",
            "--persist-to",
            "state",
            "--json",
            "--command",
            "SELECT from_path, to_path FROM redirects",
        ]
    ]


def test_existing_pairs_queries_remote_with_confirmation() -> None:
    runner = RecordingRunner(json.dumps([]))

    assert existing_pairs(runner, ["wrangler"], replace(BASE_OPTIONS, remote=True, yes=True)) == {}
    assert runner.commands == [
        [
            "wrangler",
            "--remote",
            "--yes",
            "--json",
            "--command",
            "SELECT from_path, to_path FROM redirects",
        ]
    ]


def test_execute_import_runs_wrangler_with_the_sql_file() -> None:
    runner = RecordingRunner("")

    execute_import(runner, ["wrangler"], BASE_OPTIONS, "INSERT;\n")

    assert len(runner.commands) == 1
    assert runner.commands[0][:5] == [
        "wrangler",
        "--local",
        "--persist-to",
        ".wrangler/state",
        "--file",
    ]
    assert runner.files == ["INSERT;\n"]
    assert not Path(runner.commands[0][-1]).exists()


def test_execute_import_removes_the_temporary_file_when_wrangler_fails() -> None:
    paths: list[str] = []

    def failing(command: Sequence[str]) -> str:
        paths.append(command[command.index("--file") + 1])
        message = "no"
        raise WranglerError(message)

    with pytest.raises(WranglerError, match="no"):
        execute_import(failing, ["wrangler"], BASE_OPTIONS, "INSERT;\n")

    assert paths
    assert not Path(paths[0]).exists()


def test_report_lists_every_outcome(capsys: pytest.CaptureFixture[str]) -> None:
    plan = ImportPlan(
        imported=(RedirectRow("/a", "/b"),),
        updated=(ConflictRow("x.csv:4", "/c", "/old", "/d"),),
        skipped=(SourceRow("/e", "/f", "x.csv:2"),),
        conflicts=(ConflictRow("x.csv:5", "/g", "/h", "/i"),),
        warnings=(SourceRow("/ząb", "/j", "x.csv:3"),),
        rejected=(RejectedRow("x.csv:6", "bad", "/k", "from path must start with /"),),
    )

    report(plan)

    assert capsys.readouterr().out == (
        "skip /e at x.csv:2: already present\n"
        "conflict x.csv:5: db '/h' != corpus '/i'\n"
        "update x.csv:4: db '/old' -> corpus '/d'\n"
        "warn x.csv:3: '/ząb' holds non-ascii or percent characters "
        "and may never match a request\n"
        "reject x.csv:6: 'bad' -> '/k': from path must start with /\n"
        "imported 1, updated 1, skipped 1, conflicts 1, rejected 1, warnings 1\n"
    )


def test_parse_options_defaults_to_a_local_run() -> None:
    assert parse_options(["--source", "legacy.csv"]) == replace(
        BASE_OPTIONS, sources=(Path("legacy.csv"),)
    )


def test_parse_options_reads_all_flags() -> None:
    parsed = parse_options(
        [
            "--source",
            "a.csv",
            "--source",
            "b.xml",
            "--to",
            "/kontakt",
            "--remote",
            "--yes",
            "--dry-run",
            "--update",
            "--sql-out",
            "plan.sql",
            "--persist-to",
            "state",
        ]
    )

    assert parsed == replace(
        BASE_OPTIONS,
        sources=(Path("a.csv"), Path("b.xml")),
        target="/kontakt",
        remote=True,
        yes=True,
        dry_run=True,
        update=True,
        sql_out=Path("plan.sql"),
        persist_to="state",
    )


def test_parse_options_requires_a_source() -> None:
    with pytest.raises(SystemExit) as raised:
        parse_options([])

    assert raised.value.code == 2


@pytest.mark.usefixtures("fake_pnpm")
def test_main_imports_a_fresh_batch(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    path = csv_source(tmp_path, "/a,/b\n")
    runner = RecordingRunner(json.dumps({"results": []}))

    assert main(["--source", str(path), "--persist-to", "state"], runner=runner) == 0
    assert len(runner.commands) == 2
    assert runner.commands[0][-3:] == [
        "--json",
        "--command",
        "SELECT from_path, to_path FROM redirects",
    ]
    assert runner.commands[1][-2] == "--file"
    assert runner.files[0].startswith(f"{INSERT_PREFIX}('/a', '/b', '")
    assert runner.files[0].endswith("');\n")
    assert not Path(runner.commands[1][-1]).exists()
    assert capsys.readouterr().out.endswith(
        "imported 1, updated 0, skipped 0, conflicts 0, rejected 0, warnings 0\n"
    )


@pytest.mark.usefixtures("fake_pnpm")
def test_main_skips_rows_already_present(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = csv_source(tmp_path, "/a,/b\n/c,/d\n")
    runner = RecordingRunner(
        json.dumps(
            {
                "results": [
                    {"from_path": "/a", "to_path": "/b"},
                    {"from_path": "/c", "to_path": "/d"},
                ]
            }
        )
    )

    assert main(["--source", str(path)], runner=runner) == 0
    assert len(runner.commands) == 1
    out = capsys.readouterr().out
    assert f"skip /a at {path}:2: already present\n" in out
    assert out.endswith("imported 0, updated 0, skipped 2, conflicts 0, rejected 0, warnings 0\n")


@pytest.mark.usefixtures("fake_pnpm")
def test_main_reports_conflicts_without_updating(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = csv_source(tmp_path, "/a,/b\n")
    runner = RecordingRunner(json.dumps({"results": [{"from_path": "/a", "to_path": "/c"}]}))

    assert main(["--source", str(path)], runner=runner) == 1
    assert len(runner.commands) == 1
    out = capsys.readouterr().out
    assert f"conflict {path}:2: db '/c' != corpus '/b'\n" in out
    assert out.endswith("imported 0, updated 0, skipped 0, conflicts 1, rejected 0, warnings 0\n")


@pytest.mark.usefixtures("fake_pnpm")
def test_main_upserts_conflicts_with_update(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = csv_source(tmp_path, "/a,/b\n")
    runner = RecordingRunner(json.dumps({"results": [{"from_path": "/a", "to_path": "/c"}]}))

    assert main(["--source", str(path), "--update"], runner=runner) == 0
    assert len(runner.commands) == 2
    assert runner.files[0].endswith(
        "ON CONFLICT (from_path) DO UPDATE SET to_path = excluded.to_path;\n"
    )
    assert capsys.readouterr().out.endswith(
        "imported 0, updated 1, skipped 0, conflicts 0, rejected 0, warnings 0\n"
    )


@pytest.mark.usefixtures("fake_pnpm")
def test_main_rejects_bad_rows_and_exits_non_zero(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = csv_source(tmp_path, "/a,/b\nnope,/b\n/A,/c\n")
    runner = RecordingRunner(json.dumps({"results": []}))

    assert main(["--source", str(path)], runner=runner) == 1
    out = capsys.readouterr().out
    assert f"reject {path}:3: 'nope' -> '/b': from path must start with /\n" in out
    assert f"reject {path}:4: '/A' -> '/c': duplicate in batch\n" in out
    assert out.endswith("imported 1, updated 0, skipped 0, conflicts 0, rejected 2, warnings 0\n")


@pytest.mark.usefixtures("fake_pnpm")
def test_main_warns_about_non_ascii_rows(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = csv_source(tmp_path, "/ścieżka,/a\n")
    runner = RecordingRunner(json.dumps({"results": []}))

    assert main(["--source", str(path)], runner=runner) == 0
    out = capsys.readouterr().out
    assert f"warn {path}:2: '/ścieżka' holds non-ascii or percent characters" in out
    assert out.endswith("imported 1, updated 0, skipped 0, conflicts 0, rejected 0, warnings 1\n")


@pytest.mark.usefixtures("fake_pnpm")
def test_main_dry_run_writes_the_validated_sql(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = csv_source(tmp_path, "/a,/b\n/C,/d\n")
    sql_out = tmp_path / "plan.sql"
    runner = RecordingRunner(json.dumps({"results": []}))

    code = main(["--source", str(path), "--dry-run", "--sql-out", str(sql_out)], runner=runner)

    assert code == 0
    assert len(runner.commands) == 1
    sql = sql_out.read_text(encoding="utf-8")
    assert sql.startswith(f"{INSERT_PREFIX}('/a', '/b', '")
    assert f"{INSERT_PREFIX}('/c', '/d', '" in sql
    assert sql.endswith("');\n")
    assert capsys.readouterr().out.endswith(
        "imported 2, updated 0, skipped 0, conflicts 0, rejected 0, warnings 0\n"
    )


@pytest.mark.usefixtures("fake_pnpm")
def test_main_dry_run_writes_an_empty_file_without_valid_rows(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = csv_source(tmp_path, "nope,/b\n")
    sql_out = tmp_path / "plan.sql"
    runner = RecordingRunner(json.dumps({"results": []}))

    code = main(["--source", str(path), "--dry-run", "--sql-out", str(sql_out)], runner=runner)

    assert code == 1
    assert sql_out.read_bytes() == b""
    assert capsys.readouterr().out.endswith(
        "imported 0, updated 0, skipped 0, conflicts 0, rejected 1, warnings 0\n"
    )


def test_main_refuses_remote_without_confirmation(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = csv_source(tmp_path, "/a,/b\n")
    runner = RecordingRunner("")

    assert main(["--source", str(path), "--remote"], runner=runner) == USAGE_ERROR
    assert runner.commands == []
    assert "--remote requires --yes" in capsys.readouterr().err


def test_main_reports_source_errors(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    path = tmp_path / "legacy.txt"
    path.write_text("from_path,to_path\n", encoding="utf-8")
    runner = RecordingRunner("")

    assert main(["--source", str(path)], runner=runner) == 1
    assert runner.commands == []
    assert "unsupported source type" in capsys.readouterr().err


def test_main_requires_a_verified_target_for_sitemaps(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = tmp_path / "sitemap.xml"
    path.write_text(
        "<urlset><url><loc>https://old.example/old</loc></url></urlset>", encoding="utf-8"
    )
    runner = RecordingRunner("")

    assert main(["--source", str(path)], runner=runner) == 1
    assert runner.commands == []
    assert "sitemap sources require --to" in capsys.readouterr().err


@pytest.mark.usefixtures("fake_pnpm")
def test_main_reports_wrangler_failures(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    path = csv_source(tmp_path, "/a,/b\n")

    def failing(_command: Sequence[str]) -> str:
        message = "d1 is down"
        raise WranglerError(message)

    assert main(["--source", str(path)], runner=failing) == 1
    assert "d1 is down" in capsys.readouterr().err


def test_main_reads_process_arguments(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    path = csv_source(tmp_path, "/a,/b\n")
    payload = json.dumps({"results": []})

    def fake_run_wrangler(_command: Sequence[str]) -> str:
        return payload

    def fake_which(_name: str) -> str | None:
        return "pnpm-is-here"

    monkeypatch.setattr("zsm3_tools.redirect_import.run_wrangler", fake_run_wrangler)
    monkeypatch.setattr("zsm3_tools.redirect_import.shutil.which", fake_which)
    monkeypatch.setattr("sys.argv", ["zsm3-import-legacy-urls", "--source", str(path)])

    assert main() == 0
