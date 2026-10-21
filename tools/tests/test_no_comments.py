from pathlib import Path

import pytest
from hypothesis import given
from hypothesis import strategies as st

from zsm3_tools.no_comments import (
    USAGE_ERROR,
    CommentViolation,
    comment_positions,
    find_comments,
    main,
    python_files,
)


def write(directory: Path, name: str, source: str) -> Path:
    path = directory / name
    path.write_text(source, encoding="utf-8")
    return path


def test_clean_source_has_no_violations(tmp_path: Path) -> None:
    path = write(tmp_path, "clean.py", 'value = "# not a comment"\n')

    assert list(find_comments(path)) == []


def test_reports_line_and_inline_comments(tmp_path: Path) -> None:
    path = write(tmp_path, "commented.py", "# header\nvalue = 1  # inline\n")

    assert list(find_comments(path)) == [
        CommentViolation(path, 1, 0),
        CommentViolation(path, 2, 11),
    ]


def test_allows_a_shebang_on_the_first_line(tmp_path: Path) -> None:
    path = write(tmp_path, "script.py", "#!/usr/bin/env python3\nvalue = 1\n")

    assert list(find_comments(path)) == []


def test_rejects_a_shebang_like_comment_elsewhere(tmp_path: Path) -> None:
    path = write(tmp_path, "late.py", "value = 1\n#!/usr/bin/env python3\n")

    assert list(find_comments(path)) == [CommentViolation(path, 2, 0)]


def test_rejects_an_indented_hash_bang(tmp_path: Path) -> None:
    path = write(tmp_path, "indented.py", "value = 1  #!bang\n")

    assert list(find_comments(path)) == [CommentViolation(path, 1, 11)]


def test_describe_uses_one_based_columns() -> None:
    violation = CommentViolation(Path("module.py"), 3, 4)

    assert violation.describe() == "module.py:3:5: comments are not allowed"


def test_python_files_walks_directories_in_order(tmp_path: Path) -> None:
    nested = tmp_path / "pkg"
    nested.mkdir()
    second = write(nested, "b.py", "")
    first = write(nested, "a.py", "")
    write(nested, "notes.txt", "# text")
    single = write(tmp_path, "single.py", "")

    assert list(python_files([single, nested])) == [single, first, second]


def test_main_succeeds_on_clean_code(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    write(tmp_path, "clean.py", "value = 1\n")

    assert main([str(tmp_path)]) == 0
    assert capsys.readouterr().out == ""


def test_main_fails_and_reports_comments(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = write(tmp_path, "commented.py", "value = 1  # note\n")

    assert main([str(path)]) == 1
    assert capsys.readouterr().out == f"{path}:1:12: comments are not allowed\n"


def test_main_requires_paths(capsys: pytest.CaptureFixture[str]) -> None:
    assert main([]) == USAGE_ERROR
    assert "usage:" in capsys.readouterr().err


def test_main_reads_process_arguments(tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
    write(tmp_path, "clean.py", "value = 1\n")
    monkeypatch.setattr("sys.argv", ["zsm3-no-comments", str(tmp_path)])

    assert main() == 0


@given(st.text())
def test_string_literals_never_count_as_comments(text: str) -> None:
    source = f"value = {text!r}\n".encode()

    assert list(comment_positions(source)) == []


def test_main_reports_files_that_cannot_be_tokenized(
    tmp_path: Path, capsys: pytest.CaptureFixture[str]
) -> None:
    path = write(tmp_path, "broken.py", 'value = "unterminated\n')

    assert main([str(path)]) == 1
    assert capsys.readouterr().out.startswith(f"{path}: cannot tokenize:")
