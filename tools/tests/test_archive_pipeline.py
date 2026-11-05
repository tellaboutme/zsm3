import hashlib
import socket
from pathlib import Path

import pytest

from archive_fixtures import jpeg, write
from zsm3_tools import archive_pipeline
from zsm3_tools.archive_discovery import discover
from zsm3_tools.archive_images import Encoded, convert
from zsm3_tools.archive_manifest import build, serialise
from zsm3_tools.archive_model import Settings
from zsm3_tools.archive_permissions import Permissions
from zsm3_tools.archive_pipeline import PhotoResult, Steps, file_sha256, process
from zsm3_tools.archive_store import Store

SETTINGS = Settings()


@pytest.fixture(autouse=True)
def no_network(monkeypatch: pytest.MonkeyPatch) -> None:
    def refuse(*_: object, **__: object) -> None:
        message = "the archive pipeline must not open network connections"
        raise AssertionError(message)

    monkeypatch.setattr(socket, "socket", refuse)


def tree(root: Path) -> None:
    write(root, "2019-2020/Bal/a.jpg", jpeg((900, 600), 1))
    write(root, "2019-2020/Bal/b.jpg", jpeg((900, 600), 2))
    write(root, "2019-2020/Bal/kopia a.jpg", jpeg((900, 600), 1))
    write(root, "2020-2021/Obóz/c.jpg", jpeg((600, 900), 3))
    write(root, "2020-2021/Obóz/zepsute.jpg", b"\xff\xd8\xff broken")


def run(
    source: Path, out: Path, converter: archive_pipeline.Converter = convert
) -> list[PhotoResult]:
    store = Store(out, SETTINGS)
    store.prepare()
    return process(source, discover(source, SETTINGS), store, lambda *_: None, Steps(converter))


def manifest_bytes(source: Path, results: list[PhotoResult]) -> bytes:
    inventory = discover(source, SETTINGS)
    return serialise(build(inventory, results, Permissions(), SETTINGS, "synthetic"))


def test_a_second_run_reuses_every_checkpoint(tmp_path: Path) -> None:
    source = tmp_path / "source"
    tree(source)
    first = run(source, tmp_path / "out")
    second = run(source, tmp_path / "out")

    assert [result.reused for result in first] == [False] * 5
    assert [result.reused for result in second] == [True] * 5
    assert [r.conversion for r in first] == [r.conversion for r in second]
    assert [r.conversion.error for r in first].count("unsupported_or_corrupt") == 1


def test_a_changed_source_is_converted_again(tmp_path: Path) -> None:
    source = tmp_path / "source"
    tree(source)
    run(source, tmp_path / "out")
    write(source, "2019-2020/Bal/b.jpg", jpeg((900, 600), 9))

    again = {r.photo.path: r.reused for r in run(source, tmp_path / "out")}

    assert again["2019-2020/Bal/b.jpg"] is False
    assert sum(again.values()) == 4


def test_an_interrupted_run_resumes_to_the_same_manifest(tmp_path: Path) -> None:
    source = tmp_path / "source"
    tree(source)
    calls = 0

    def crash_on_third(data: bytes, settings: Settings) -> Encoded:
        nonlocal calls
        calls += 1
        if calls == 3:
            raise KeyboardInterrupt
        return convert(data, settings)

    with pytest.raises(KeyboardInterrupt):
        run(source, tmp_path / "interrupted", crash_on_third)
    resumed = run(source, tmp_path / "interrupted")
    clean = run(source, tmp_path / "clean")

    assert [r.reused for r in resumed] == [True, True, False, False, False]
    assert manifest_bytes(source, resumed) == manifest_bytes(source, clean)


def test_sources_that_change_vanish_or_become_links_are_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "source"
    tree(source)
    store = Store(tmp_path / "out", Settings(max_source_bytes=100))
    store.prepare()
    inventory = discover(source, SETTINGS)
    (source / "2020-2021" / "Obóz" / "c.jpg").unlink()
    original = Path.is_symlink
    monkeypatch.setattr(Path, "is_symlink", lambda path: path.name == "b.jpg" or original(path))

    errors = [r.conversion.error for r in process(source, inventory, store, lambda *_: None)]

    assert errors == [
        "source_too_large",
        "link_not_followed",
        "source_too_large",
        "missing_source",
        "unsupported_or_corrupt",
    ]


def test_a_file_rewritten_between_hashing_and_reading_is_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    source = tmp_path / "source"
    write(source, "album/a.jpg", jpeg((900, 600), 1))
    monkeypatch.setattr(archive_pipeline, "file_sha256", lambda _: "0" * 64)

    [result] = run(source, tmp_path / "out")

    assert result.conversion.error == "changed_during_run"


def test_hashing_streams_the_file(tmp_path: Path) -> None:
    content = b"x" * (3 << 20)
    path = write(tmp_path, "big.bin", content)

    assert file_sha256(path) == hashlib.sha256(content).hexdigest()
