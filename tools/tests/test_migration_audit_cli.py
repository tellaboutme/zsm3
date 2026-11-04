import json
from pathlib import Path

import pytest

from zsm3_tools import migration_report
from zsm3_tools.migration_audit import Category, Finding
from zsm3_tools.migration_audit_cli import REPOSITORY, main
from zsm3_tools.migration_probe import Prober
from zsm3_tools.migration_report import Report, markdown

MAP = (
    "from_path,to_path\n/stara/,/x/y\n/x/y,/nowa\n/kontakt,/nowa\n"
    "/petla,/petla-b\n/petla-b,/petla\n"
)
UNRESOLVED = (
    "from_path,previous_to_path,reason\n/archiwum/,/uczniowie,archive content not available\n"
)
PAGES = ["kontakt.astro", "nowa.astro", "[section]/index.astro", "[section]/[page].astro"]
URLS = "/stara/\n/kontakt\n/petla\n/archiwum/\n/wp-content/uploads/plan.pdf\n/a/b/c\nbad path\n"


def fixture(root: Path) -> list[str]:
    pages = root / "pages"
    for name in PAGES:
        (pages / name).parent.mkdir(parents=True, exist_ok=True)
        (pages / name).write_text("", encoding="utf-8")
    (root / "map.csv").write_text(MAP, encoding="utf-8")
    (root / "unresolved.csv").write_text(UNRESOLVED, encoding="utf-8")
    (root / "urls.txt").write_text(URLS, encoding="utf-8")
    (root / "cms.txt").write_text("/kontakt\n/szkola/historia\n", encoding="utf-8")
    (root / "inventory.json").write_text(
        json.dumps(
            [
                {
                    "url": "https://www.zespolszkolmechanicznych.edu.pl/kontakt/",
                    "status": "discovered",
                }
            ]
        ),
        encoding="utf-8",
    )
    return [
        *("--urls", str(root / "urls.txt"), "--inventory", str(root / "inventory.json")),
        *("--map", str(root / "map.csv"), "--unresolved", str(root / "unresolved.csv")),
        *("--pages", str(pages), "--cms-paths", str(root / "cms.txt")),
    ]


def test_a_dry_run_writes_stable_reports_outside_the_repository(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    args = [*fixture(tmp_path), "--out-dir", str(tmp_path / "out")]

    assert main(args) == 0
    first = {
        name: (tmp_path / "out" / name).read_bytes()
        for name in ("manifest.json", "report.md", "candidates.csv")
    }
    assert main(args) == 1
    assert "pass --overwrite" in capsys.readouterr().err
    assert main([*args, "--overwrite"]) == 0
    assert {name: (tmp_path / "out" / name).read_bytes() for name in first} == first

    manifest = json.loads(first["manifest.json"])
    assert manifest["summary"]["mapped_chain"] == 1
    assert manifest["summary"]["mapped_shadowed"] == 1
    assert manifest["summary"]["mapped_loop"] == 1
    assert manifest["summary"]["unresolved"] == 1
    assert manifest["summary"]["document_review"] == 1
    assert manifest["summary"]["missing"] == 1
    assert manifest["cms"] == [
        {"path": "/kontakt", "category": "cms_shadowed", "route": "kontakt.astro"}
    ]
    assert [row["reason"] for row in manifest["rejected"]] == ["empty or contains whitespace"]
    assert first["candidates.csv"].decode().splitlines() == [
        "action,from_path,to_path",
        "break_loop,/petla,",
        "remove_shadowed,/kontakt,/nowa",
        "collapse_chain,/stara,/nowa",
    ]
    report = first["report.md"].decode()
    assert report.startswith("# Legacy migration audit\n")
    assert "## mapped_chain (1)" in report
    assert "## Rejected input" in report
    assert not list((tmp_path / "out").glob(".*.partial"))


class Fixed:
    def status(self, path: str) -> int:
        return 200 if path in {"/nowa", "/x/y"} else 404


def test_probing_a_preview_replaces_route_guesses(tmp_path: Path) -> None:
    def factory(origin: str) -> Prober:
        assert origin == "http://127.0.0.1:8787"
        return Fixed()

    sitemap = tmp_path / "sitemap.xml"
    sitemap.write_text(
        "<urlset><url><loc>https://zsm3.example/nowa</loc></url></urlset>", encoding="utf-8"
    )
    args = [*fixture(tmp_path), "--out-dir", str(tmp_path / "out"), "--sitemap", str(sitemap)]

    assert main([*args, "--probe", "http://127.0.0.1:8787", "--delay", "0"], factory) == 0
    manifest = json.loads((tmp_path / "out" / "manifest.json").read_text(encoding="utf-8"))
    by_key = {row["key"]: row for row in manifest["findings"]}
    assert by_key["/stara"]["category"] == "mapped"
    assert by_key["/stara"]["target"] == "/x/y"
    assert by_key["/stara"]["notes"] == ["target_not_in_sitemap"]
    assert by_key["/kontakt"]["category"] == "mapped"


@pytest.mark.parametrize(
    "extra",
    [[], ["--unknown"], ["--urls", "x.txt", "--delay", "fast"]],
)
def test_usage_errors_exit_with_two(tmp_path: Path, extra: list[str]) -> None:
    assert main([*extra, "--out-dir", str(tmp_path / "out")]) == 2


def test_input_and_output_problems_exit_with_one(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    args = fixture(tmp_path)

    assert main([*args, "--out-dir", str(REPOSITORY / "reports" / "migration")]) == 1
    assert "outside the repository" in capsys.readouterr().err
    (tmp_path / "map.csv").write_text("a,b\n", encoding="utf-8")
    assert main([*args, "--out-dir", str(tmp_path / "out")]) == 1
    assert "first row" in capsys.readouterr().err
    assert (
        main(
            [
                *fixture(tmp_path),
                "--out-dir",
                str(tmp_path / "o2"),
                "--probe",
                "http://example.edu.pl",
            ]
        )
        == 1
    )
    assert "local preview" in capsys.readouterr().err


def test_long_sections_point_to_the_manifest(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(migration_report, "MAX_LISTED", 1)
    rows = [Finding(f"/p{n}", Category.MISSING, None, (f"/p{n}",), ("a|b",)) for n in range(2)]

    text = markdown(Report(rows, [], [])).decode()

    assert "| … 1 more in the manifest | | |" in text
    assert "a\\|b" in text
    assert "## CMS pages" not in text


class Failing:
    def status(self, path: str) -> int:
        return 503 if path == "/nowa" else 404


def test_a_failing_preview_still_writes_reports_but_exits_with_three(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    args = [*fixture(tmp_path), "--out-dir", str(tmp_path / "out")]

    code = main([*args, "--probe", "http://127.0.0.1:8787", "--delay", "0"], lambda _: Failing())

    manifest = json.loads((tmp_path / "out" / "manifest.json").read_text(encoding="utf-8"))
    by_key = {row["key"]: row["category"] for row in manifest["findings"]}
    assert code == 3
    assert by_key["/kontakt"] == "probe_error"
    assert "preview failed for" in capsys.readouterr().err
    assert "## probe_error" in (tmp_path / "out" / "report.md").read_text(encoding="utf-8")
