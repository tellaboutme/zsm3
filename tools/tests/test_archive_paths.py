from pathlib import Path

import pytest

from zsm3_tools import archive_paths
from zsm3_tools.archive_paths import (
    RUN_MARKER,
    ArchivePathError,
    output_root,
    remove_partials,
    safe_relative,
    source_root,
    write_atomic,
)


def test_the_source_must_be_a_real_directory(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    assert source_root(tmp_path) == tmp_path.resolve()
    with pytest.raises(ArchivePathError, match="not a directory"):
        source_root(tmp_path / "missing")
    monkeypatch.setattr(Path, "is_symlink", lambda _: True)
    with pytest.raises(ArchivePathError, match="symbolic link"):
        source_root(tmp_path)


def test_outputs_stay_outside_the_repository_and_the_source(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    for unsafe, reason in [
        (archive_paths.REPOSITORY / "out", "outside the repository"),
        (source / "out", "overlap"),
        (tmp_path, "overlap"),
    ]:
        with pytest.raises(ArchivePathError, match=reason):
            output_root(unsafe, source, resume=False)
    assert output_root(tmp_path / "fresh", source, resume=False) == (tmp_path / "fresh").resolve()


def test_outputs_stay_outside_any_git_repository(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    other = tmp_path / "other-project"
    (other / ".git").mkdir(parents=True)
    with pytest.raises(ArchivePathError, match="any Git repository"):
        output_root(other / "deep" / "out", source, resume=False)


def test_existing_outputs_are_never_silently_reused(tmp_path: Path) -> None:
    source = tmp_path / "source"
    source.mkdir()
    file = tmp_path / "file"
    file.write_text("x", encoding="utf-8")
    other = tmp_path / "other"
    other.mkdir()
    (other / "notes.txt").write_text("x", encoding="utf-8")
    earlier = tmp_path / "earlier"
    earlier.mkdir()
    (earlier / RUN_MARKER).write_text("x", encoding="utf-8")

    with pytest.raises(ArchivePathError, match="not a directory"):
        output_root(file, source, resume=False)
    with pytest.raises(ArchivePathError, match="another tool"):
        output_root(other, source, resume=True)
    with pytest.raises(ArchivePathError, match="--resume"):
        output_root(earlier, source, resume=False)
    assert output_root(earlier, source, resume=True) == earlier.resolve()


@pytest.mark.parametrize("value", ["", "/abs", "a/../b", "a//b", "./a", "a\\b", "a/"])
def test_unsafe_relative_paths_are_refused(value: str) -> None:
    with pytest.raises(ArchivePathError):
        safe_relative(value)


def test_safe_relative_paths_are_kept() -> None:
    assert safe_relative("2019-2020/Łódź/zdjęcie.jpg") == "2019-2020/Łódź/zdjęcie.jpg"


def test_atomic_writes_leave_no_partial_file(tmp_path: Path) -> None:
    target = tmp_path / "manifest.json"
    write_atomic(target, b"one")
    write_atomic(target, b"two")
    (tmp_path / ".x.partial").write_bytes(b"half")

    assert target.read_bytes() == b"two"
    assert remove_partials(tmp_path) == 1
    assert sorted(path.name for path in tmp_path.iterdir()) == ["manifest.json"]
