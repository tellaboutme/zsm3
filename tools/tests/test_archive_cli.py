import json
from pathlib import Path

import pytest

from archive_fixtures import PRIVATE_NOTE, archive, jpeg, write
from zsm3_tools import archive_cli
from zsm3_tools.archive_cli import main
from zsm3_tools.archive_report import markdown


def source_tree(root: Path) -> Path:
    source = root / "źródło"
    archive(source, albums=4, per_album=3)
    first = next(iter(sorted((source / "2015-2016").iterdir())))
    write(source, "2015-2016/kopie/duplikat.jpg", (first / "IMG_0000.jpg").read_bytes())
    write(source, "2015-2016/kopie/zepsute.jpg", b"\xff\xd8 broken")
    write(source, "Bez roku/IMG_0001.jpg", jpeg((800, 600), 77))
    return source


def permissions(root: Path, source: Path) -> Path:
    album = min(p.name for p in (source / "2015-2016").iterdir() if p.name != "kopie")
    path = root / "permissions.json"
    document = {
        "version": 1,
        "albums": [
            {
                "path": f"2015-2016/{album}",
                "status": "approved",
                "by": "sekretariat@zsm3.test",
                "at": "2027-01-01",
                "basis": "zgoda",
                "reference": "D-1",
            }
        ],
        "photos": [
            {"path": f"2015-2016/{album}/IMG_{n:04d}.jpg", "alt": "Uczniowie w muzeum"}
            for n in range(2)
        ],
    }
    path.write_text(json.dumps(document, ensure_ascii=False), encoding="utf-8")
    return path


def dry_run(source: Path, out: Path, *extra: str) -> int:
    return main(["dry-run", "--source", str(source), "--out", str(out), "--label", "test", *extra])


def test_a_dry_run_writes_a_deterministic_gated_manifest(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = source_tree(tmp_path)
    granted = permissions(tmp_path, source)

    assert dry_run(source, tmp_path / "out", "--permissions", str(granted)) == 0
    first = (tmp_path / "out" / "manifest.json").read_bytes()
    assert dry_run(source, tmp_path / "out", "--permissions", str(granted), "--resume") == 0
    assert dry_run(source, tmp_path / "again", "--permissions", str(granted)) == 0

    assert (tmp_path / "out" / "manifest.json").read_bytes() == first
    assert (tmp_path / "again" / "manifest.json").read_bytes() == first
    manifest = json.loads(first)
    assert manifest["summary"]["outcomes"] == {
        "invalid": 0,
        "duplicate": 1,
        "rejected": 0,
        "missing_permission": 11,
        "incomplete": 1,
        "eligible": 2,
    }
    report = (tmp_path / "out" / "report.md").read_text(encoding="utf-8")
    assert "DRY RUN ONLY" in report
    assert "No problems in eligible records." in report
    assert "IMG_0000" not in report
    assert PRIVATE_NOTE not in report
    out = capsys.readouterr().out
    assert "processed 15/15 photos" in out
    assert "IMG_" not in out
    assert (
        main(
            [
                "validate",
                "--manifest",
                str(tmp_path / "out" / "manifest.json"),
                "--variants",
                str(tmp_path / "out" / "variants"),
            ]
        )
        == 0
    )


def test_photos_without_approval_leave_no_derived_files(tmp_path: Path) -> None:
    source = source_tree(tmp_path)
    out = tmp_path / "out"

    assert dry_run(source, out, "--permissions", str(permissions(tmp_path, source))) == 0

    photos = json.loads((out / "manifest.json").read_bytes())["photos"]
    waiting = [p for p in photos if p["outcome"] == "missing_permission"]
    assert waiting
    assert {p["conversion"] for p in waiting} == {"skipped"}
    assert all(p["large_sha256"] is None for p in waiting)
    allowed = {p["large_sha256"] for p in photos if p["conversion"] == "converted"}
    kept = {file.name.rsplit("-", 1)[0] for file in (out / "variants").iterdir()}
    assert kept == allowed


def test_a_full_check_can_convert_photos_without_approval(tmp_path: Path) -> None:
    source = source_tree(tmp_path)
    out = tmp_path / "out"
    grant = str(permissions(tmp_path, source))

    assert dry_run(source, out, "--permissions", grant, "--convert-unapproved") == 0

    summary = json.loads((out / "manifest.json").read_bytes())["summary"]
    assert summary["outcomes"]["invalid"] == 1
    assert summary["outcomes"]["missing_permission"] == 10


def test_withdrawn_approval_removes_earlier_files_on_resume(tmp_path: Path) -> None:
    source = source_tree(tmp_path)
    out = tmp_path / "out"
    grant = permissions(tmp_path, source)
    assert dry_run(source, out, "--permissions", str(grant)) == 0
    assert list((out / "variants").iterdir())

    grant.write_text('{"version": 1}', encoding="utf-8")
    assert dry_run(source, out, "--permissions", str(grant), "--resume") == 0

    assert list((out / "variants").iterdir()) == []
    assert list((out / "records").iterdir()) == []


def test_validation_problems_fail_the_run(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    source = source_tree(tmp_path)
    monkeypatch.setattr(archive_cli, "validate", lambda *_: ["photo x: broken"])

    assert (
        dry_run(source, tmp_path / "out", "--permissions", str(permissions(tmp_path, source))) == 1
    )
    assert "- photo x: broken" in (tmp_path / "out" / "report.md").read_text(encoding="utf-8")


def test_validate_reports_foreign_or_broken_manifests(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    broken = tmp_path / "broken.json"
    broken.write_text("{", encoding="utf-8")
    foreign = tmp_path / "foreign.json"
    foreign.write_text("[]", encoding="utf-8")

    assert main(["validate", "--manifest", str(broken)]) == 1
    assert main(["validate", "--manifest", str(foreign)]) == 1
    assert "not a dry-run manifest" in capsys.readouterr().out
    monkeypatch.setattr(archive_cli, "MAX_MANIFEST_BYTES", 1)
    assert main(["validate", "--manifest", str(foreign)]) == 1
    assert "too large" in capsys.readouterr().err


@pytest.mark.parametrize(
    "extra",
    [
        [],
        ["upload"],
        ["dry-run", "--source", "x"],
        ["dry-run", "--source", "x", "--out", "y", "--quality", "20"],
        ["dry-run", "--source", "x", "--out", "y", "--max-files", "0"],
        ["dry-run", "--source", "x", "--out", "y", "--max-depth", "many"],
    ],
)
def test_usage_errors_exit_with_two(extra: list[str]) -> None:
    assert main(extra) == 2


def test_unsafe_paths_and_bad_inputs_exit_with_one(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    source = source_tree(tmp_path)
    bad = tmp_path / "bad.json"
    bad.write_text("[]", encoding="utf-8")

    assert dry_run(source, source / "out") == 1
    assert dry_run(source, tmp_path / "x", "--permissions", str(bad)) == 1
    assert dry_run(source, tmp_path / "y", "--max-files", "2") == 1
    assert dry_run(tmp_path / "missing", tmp_path / "z", "--quality", "75") == 1
    err = capsys.readouterr().err
    assert "overlap" in err
    assert "expected version 1" in err
    assert "more than 2 photos" in err
    assert "not a directory" in err


def test_the_report_escapes_table_cells() -> None:
    manifest = {
        "photos": [{"outcome": "invalid", "reasons": ["a|b"]}],
        "albums": [{"album_path": "x|y", "issues": [], "eligible_count": 0, "photo_count": 1}],
        "ignored": [{"path": "p", "reason": "hidden"}],
    }

    text = markdown(manifest, []).decode()

    assert "| a\\|b | 1 |" in text
    assert "| x\\|y | ? | None | 0/1 | - |" in text
    assert "| hidden | 1 |" in text
    assert markdown({"photos": "nope"}, ["p"]).decode().count("Photos: 0") == 1
