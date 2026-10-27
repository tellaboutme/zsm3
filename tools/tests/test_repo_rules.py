import subprocess
import sys
from collections.abc import Sequence
from pathlib import Path

import pytest

from zsm3_tools.repo_rules import (
    AI_MARKERS,
    ROBOTS_EXPECTED,
    ROBOTS_PATH,
    ROBOTS_REASON,
    USAGE_ERROR,
    GitError,
    RuleViolation,
    ai_marker_in,
    content_violations,
    git_prefix,
    has_cyrillic,
    is_binary,
    is_exempt,
    main,
    read_text,
    readable_files,
    robots_violation,
    run_git,
    scan_tree,
    tracked_files,
)


def write(directory: Path, name: str, content: str) -> Path:
    path = directory / name
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8", newline="")
    return path


def stage(root: Path, name: str, content: str) -> Path:
    path = write(root, name, content)
    subprocess.run(["git", "add", name], cwd=root, check=True)
    return path


def init_repo(root: Path) -> None:
    subprocess.run(["git", "init", "--quiet"], cwd=root, check=True)


def test_describe_joins_location_and_reason() -> None:
    violation = RuleViolation("a.ts", "contains Cyrillic text")

    assert violation.describe() == "a.ts: contains Cyrillic text"


def test_has_cyrillic_detects_the_cyrillic_block() -> None:
    assert has_cyrillic("Привет") is True
    assert has_cyrillic("") is False
    assert has_cyrillic("Zespół Szkół Mechanicznych") is False


@pytest.mark.parametrize("marker", AI_MARKERS)
def test_ai_marker_in_matches_each_marker_case_insensitively(marker: str) -> None:
    assert ai_marker_in(f"Built with {marker.upper()} today") == marker


def test_ai_marker_in_returns_none_for_clean_text() -> None:
    assert ai_marker_in("Zebranie z rodzicami 9 wrzesnia") is None


def test_is_exempt_matches_the_rule_sheet_and_the_checker_itself() -> None:
    assert is_exempt(Path("CLAUDE.md")) is True
    assert is_exempt(Path("tools/src/zsm3_tools/repo_rules.py")) is True
    assert is_exempt(Path("tools/tests/test_repo_rules.py")) is True
    assert is_exempt(Path(".github/pull_request_template.md")) is True
    assert is_exempt(Path(".github/scripts/check-commit-messages.sh")) is True
    assert is_exempt(Path("docs/en/architecture.md")) is False


def test_is_exempt_matches_generated_wrangler_types_by_name() -> None:
    assert is_exempt(Path("apps/web/worker/worker-configuration.d.ts")) is True
    assert is_exempt(Path("apps/worker/worker-configuration.d.ts")) is True


def test_is_binary_detects_a_null_byte_in_the_sniffed_window() -> None:
    assert is_binary(b"\x89PNG\x00\x00") is True
    assert is_binary(b"plain text") is False


def test_read_text_returns_none_for_binary_and_missing_files(tmp_path: Path) -> None:
    binary = tmp_path / "image.png"
    binary.write_bytes(b"\x89PNG\x00\x01")

    assert read_text(binary) is None
    assert read_text(tmp_path / "missing.ts") is None


def test_read_text_returns_none_for_invalid_utf8_without_a_null_byte(tmp_path: Path) -> None:
    broken = tmp_path / "broken.ts"
    broken.write_bytes(b"\xff\xfe")

    assert read_text(broken) is None


def test_read_text_returns_decoded_content(tmp_path: Path) -> None:
    path = write(tmp_path, "clean.ts", "export const x = 1;\n")

    assert read_text(path) == "export const x = 1;\n"


def test_content_violations_skips_exempt_paths() -> None:
    assert list(content_violations(Path("CLAUDE.md"), "Claude Привет")) == []


def test_content_violations_reports_cyrillic_and_ai_markers() -> None:
    path = Path("apps/web/src/lib/seo.ts")

    assert list(content_violations(path, "const x = 1;\n")) == []
    assert list(content_violations(path, "Привет")) == [
        RuleViolation(str(path), "contains Cyrillic text"),
    ]
    assert list(content_violations(path, "Generated with Claude Code")) == [
        RuleViolation(str(path), "mentions 'claude'"),
    ]
    assert list(content_violations(path, "Привет, Anthropic")) == [
        RuleViolation(str(path), "contains Cyrillic text"),
        RuleViolation(str(path), "mentions 'anthropic'"),
    ]


def test_readable_files_skips_binary_entries(tmp_path: Path) -> None:
    write(tmp_path, "a.ts", "const a = 1;\n")
    (tmp_path / "b.png").write_bytes(b"\x89PNG\x00\x00")

    assert list(readable_files(tmp_path, [Path("a.ts"), Path("b.png")])) == [
        (Path("a.ts"), "const a = 1;\n"),
    ]


def test_robots_violation_is_none_when_closed(tmp_path: Path) -> None:
    write(tmp_path, str(ROBOTS_PATH), ROBOTS_EXPECTED)

    assert robots_violation(tmp_path) is None


def test_robots_violation_reports_an_open_or_missing_file(tmp_path: Path) -> None:
    assert robots_violation(tmp_path) == RuleViolation(str(ROBOTS_PATH), ROBOTS_REASON)

    write(tmp_path, str(ROBOTS_PATH), "User-agent: *\nAllow: /\n")

    assert robots_violation(tmp_path) == RuleViolation(str(ROBOTS_PATH), ROBOTS_REASON)


def test_scan_tree_combines_content_and_robots_violations(tmp_path: Path) -> None:
    write(tmp_path, str(ROBOTS_PATH), ROBOTS_EXPECTED)
    write(tmp_path, "a.ts", "Привет")

    assert scan_tree(tmp_path, [Path("a.ts")]) == [
        RuleViolation("a.ts", "contains Cyrillic text"),
    ]


def test_scan_tree_reports_both_kinds_together(tmp_path: Path) -> None:
    write(tmp_path, "a.ts", "const a = 1;\n")

    assert scan_tree(tmp_path, [Path("a.ts")]) == [
        RuleViolation(str(ROBOTS_PATH), ROBOTS_REASON),
    ]


def test_git_prefix_resolves_a_real_binary() -> None:
    assert git_prefix() != ""


def test_git_prefix_requires_git(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("zsm3_tools.repo_rules.shutil.which", lambda _name: None)

    with pytest.raises(GitError, match="git is required"):
        git_prefix()


def test_run_git_returns_stdout() -> None:
    assert run_git([sys.executable, "-c", "print('ok')"]) == "ok\n"


def test_run_git_raises_with_stderr() -> None:
    with pytest.raises(GitError, match="boom"):
        run_git([sys.executable, "-c", "import sys; sys.stderr.write('boom'); raise SystemExit(3)"])


def test_run_git_reports_the_exit_code_without_stderr() -> None:
    with pytest.raises(GitError, match="exited with 3"):
        run_git([sys.executable, "-c", "raise SystemExit(3)"])


def test_tracked_files_parses_and_filters_blank_lines() -> None:
    def fake_runner(_command: Sequence[str]) -> str:
        return "a.ts\n\nb/c.ts\n"

    assert tracked_files(Path(), runner=fake_runner) == [Path("a.ts"), Path("b/c.ts")]


def test_tracked_files_lists_a_real_git_index(tmp_path: Path) -> None:
    init_repo(tmp_path)
    stage(tmp_path, "one.ts", "const a = 1;\n")
    stage(tmp_path, "two.ts", "const b = 2;\n")

    assert sorted(tracked_files(tmp_path)) == [Path("one.ts"), Path("two.ts")]


def test_main_requires_a_root_argument(capsys: pytest.CaptureFixture[str]) -> None:
    assert main([]) == USAGE_ERROR
    assert "usage:" in capsys.readouterr().err


def test_main_succeeds_on_a_clean_repository(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    init_repo(tmp_path)
    stage(tmp_path, "clean.ts", "export const ok = true;\n")
    stage(tmp_path, str(ROBOTS_PATH), ROBOTS_EXPECTED)

    assert main([str(tmp_path)]) == 0
    assert capsys.readouterr().out == ""


def test_main_reports_every_violation(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    init_repo(tmp_path)
    stage(tmp_path, "bad.ts", "Привет, Claude")

    assert main([str(tmp_path)]) == 1
    out = capsys.readouterr().out
    assert "bad.ts: contains Cyrillic text" in out
    assert "bad.ts: mentions 'claude'" in out
    assert str(ROBOTS_PATH) in out


def test_main_reads_process_arguments(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    init_repo(tmp_path)
    stage(tmp_path, "clean.ts", "export const ok = true;\n")
    stage(tmp_path, str(ROBOTS_PATH), ROBOTS_EXPECTED)
    monkeypatch.setattr("sys.argv", ["zsm3-repo-rules", str(tmp_path)])

    assert main() == 0
