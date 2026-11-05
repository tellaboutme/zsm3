import os
from pathlib import Path, PurePosixPath

REPOSITORY = Path(__file__).resolve().parents[3]
RUN_MARKER = ".gallery-archive-run"


class ArchivePathError(ValueError):
    pass


def _inside(child: Path, parent: Path) -> bool:
    return child == parent or child.is_relative_to(parent)


def _inside_git_repository(path: Path) -> bool:
    return any((folder / ".git").exists() for folder in (path, *path.parents))


def source_root(value: Path) -> Path:
    if value.is_symlink():
        message = f"{value}: the source must not be a symbolic link"
        raise ArchivePathError(message)
    root = value.resolve()
    if not root.is_dir():
        message = f"{value}: the source is not a directory"
        raise ArchivePathError(message)
    return root


def output_root(value: Path, source: Path, *, resume: bool) -> Path:
    out = value.resolve()
    if _inside(out, REPOSITORY):
        message = f"{value}: write outputs outside the repository; they hold archive paths"
        raise ArchivePathError(message)
    if _inside_git_repository(out):
        message = f"{value}: write outputs outside any Git repository; they hold archive paths"
        raise ArchivePathError(message)
    if _inside(out, source) or _inside(source, out):
        message = f"{value}: the output must not overlap the source directory"
        raise ArchivePathError(message)
    if out.exists() and not out.is_dir():
        message = f"{value}: the output exists and is not a directory"
        raise ArchivePathError(message)
    entries = list(out.iterdir()) if out.exists() else []
    marked = (out / RUN_MARKER).is_file()
    if entries and not marked:
        message = f"{value}: refusing to write into a non-empty directory from another tool"
        raise ArchivePathError(message)
    if marked and not resume:
        message = f"{value}: holds an earlier run; pass --resume to continue it"
        raise ArchivePathError(message)
    return out


def relative_posix(path: Path, root: Path) -> str:
    return PurePosixPath(*path.relative_to(root).parts).as_posix()


def safe_relative(value: str) -> str:
    pure = PurePosixPath(value)
    if (
        value == ""
        or "\\" in value
        or pure.is_absolute()
        or any(part in {"", ".", ".."} for part in value.split("/"))
    ):
        message = f"{value!r}: not a relative archive path"
        raise ArchivePathError(message)
    return pure.as_posix()


def write_atomic(path: Path, data: bytes) -> None:
    partial = path.with_name(f".{path.name}.partial")
    with partial.open("wb") as handle:
        handle.write(data)
        handle.flush()
        os.fsync(handle.fileno())
    partial.replace(path)


def remove_partials(directory: Path) -> int:
    removed = 0
    for leftover in sorted(directory.glob(".*.partial")):
        leftover.unlink()
        removed += 1
    return removed
