import os
from pathlib import Path

import pytest

from archive_fixtures import write
from zsm3_tools.archive_discovery import (
    DiscoveryError,
    describe_album,
    discover,
    school_year,
    slug_of,
)
from zsm3_tools.archive_model import Ignored, Settings, SourceAlbum


@pytest.mark.parametrize(
    ("name", "expected"),
    [
        ("2019-2020", ("2019/2020", "")),
        ("2019_20 Wycieczka", ("2019/2020", "Wycieczka")),
        ("1999-00 Bal", ("1999/2000", "Bal")),
        ("2019 2020 - Dzień Sportu", ("2019/2020", "Dzień Sportu")),
        ("2019-2021", (None, "2019-2021")),
        ("2019", (None, "2019")),
        ("20191-2020", (None, "20191-2020")),
        ("Studniówka", (None, "Studniówka")),
    ],
)
def test_school_years_are_read_only_from_two_consecutive_years(
    name: str, expected: tuple[str | None, str]
) -> None:
    assert school_year(name) == expected


def test_slugs_fold_polish_letters_and_stay_within_the_contract() -> None:
    assert slug_of("Wycieczka \u2013 Kraków, Łódź i Żywiec!") == "wycieczka-krakow-lodz-i-zywiec"
    assert slug_of("!!!") is None
    long = slug_of("słowo " * 40)
    assert long is not None
    assert len(long) <= 120
    assert not long.endswith("-")


def test_albums_take_the_year_from_their_own_name_or_a_parent() -> None:
    assert describe_album("2018-2019/Dzień Ziemi") == SourceAlbum(
        "2018-2019/Dzień Ziemi", "2018/2019", "Dzień Ziemi", "dzien-ziemi"
    )
    assert describe_album("archiwum/2017-2018 Bal_maturalny") == SourceAlbum(
        "archiwum/2017-2018 Bal_maturalny", "2017/2018", "Bal maturalny", "bal-maturalny"
    )
    assert describe_album("bez roku/2018-2019") == SourceAlbum(
        "bez roku/2018-2019", "2018/2019", None, None
    )
    assert describe_album("Różne").school_year is None
    titled = describe_album("x" * 250)
    assert titled.title is not None
    assert len(titled.title) == 200


def test_the_walk_classifies_every_entry_and_keeps_polish_names(tmp_path: Path) -> None:
    write(tmp_path, "2019-2020/Wycieczka do Łodzi/zdjęcie 1.JPG", b"x")
    write(tmp_path, "2019-2020/Wycieczka do Łodzi/notatki.txt", b"x")
    write(tmp_path, "2019-2020/Wycieczka do Łodzi/Thumbs.db", b"x")
    write(tmp_path, "2019-2020/paczka.zip", b"x")
    write(tmp_path, "2019-2020/.ukryte/a.jpg", b"x")
    write(tmp_path, "luźne.png", b"xy")
    write(tmp_path, "bez rozszerzenia", b"x")
    (tmp_path / "pusty").mkdir()

    inventory = discover(tmp_path, Settings())

    assert [(p.path, p.album, p.extension, p.size_bytes) for p in inventory.photos] == [
        ("2019-2020/Wycieczka do Łodzi/zdjęcie 1.JPG", "2019-2020/Wycieczka do Łodzi", "jpg", 1),
        ("luźne.png", None, "png", 2),
    ]
    assert [album.path for album in inventory.albums] == ["2019-2020/Wycieczka do Łodzi"]
    assert inventory.ignored == (
        Ignored("2019-2020/.ukryte", "hidden"),
        Ignored("2019-2020/Wycieczka do Łodzi/Thumbs.db", "system_file"),
        Ignored("2019-2020/Wycieczka do Łodzi/notatki.txt", "not_an_image"),
        Ignored("2019-2020/paczka.zip", "archive_not_supported"),
        Ignored("bez rozszerzenia", "not_an_image"),
        Ignored("pusty", "empty_directory"),
    )


def test_depth_and_file_count_are_bounded(tmp_path: Path) -> None:
    write(tmp_path, "a/b/c/d.jpg", b"x")
    write(tmp_path, "a/e.jpg", b"x")
    write(tmp_path, "a/f.jpg", b"x")

    shallow = discover(tmp_path, Settings(max_depth=2))

    assert [photo.path for photo in shallow.photos] == ["a/e.jpg", "a/f.jpg"]
    assert shallow.ignored == (Ignored("a/b/c", "too_deep"),)
    with pytest.raises(DiscoveryError, match="more than 2 photos"):
        discover(tmp_path, Settings(max_files=2))


class _Entry:
    def __init__(self, path: Path, *, link: bool = False, junction: bool = False) -> None:
        self.path = str(path)
        self.name = path.name
        self._link, self._junction = link, junction

    def is_symlink(self) -> bool:
        return self._link

    def is_junction(self) -> bool:
        return self._junction

    def is_dir(self, *, follow_symlinks: bool = True) -> bool:
        return follow_symlinks and False

    def is_file(self, *, follow_symlinks: bool = True) -> bool:
        return follow_symlinks and False


class _Listing:
    def __init__(self, entries: list[_Entry]) -> None:
        self.entries = entries

    def __enter__(self) -> list[_Entry]:
        return self.entries

    def __exit__(self, *_: object) -> None:
        return None


def test_links_junctions_and_special_files_are_never_followed(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    entries = [
        _Entry(tmp_path / "link.jpg", link=True),
        _Entry(tmp_path / "junction", junction=True),
        _Entry(tmp_path / "fifo"),
    ]
    monkeypatch.setattr(os, "scandir", lambda _: _Listing(entries))

    inventory = discover(tmp_path, Settings())

    assert inventory.ignored == (
        Ignored("fifo", "not_a_regular_file"),
        Ignored("junction", "link_not_followed"),
        Ignored("link.jpg", "link_not_followed"),
    )


def test_a_real_symbolic_link_is_reported_not_followed(tmp_path: Path) -> None:
    outside = write(tmp_path, "outside/secret.jpg", b"x")
    source = tmp_path / "source"
    source.mkdir()
    try:
        (source / "secret.jpg").symlink_to(outside)
    except OSError:
        pytest.skip("symbolic links need extra rights on this system")

    inventory = discover(source, Settings())

    assert inventory.photos == ()
    assert inventory.ignored == (Ignored("secret.jpg", "link_not_followed"),)
