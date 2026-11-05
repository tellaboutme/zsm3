import json

import pytest

from zsm3_tools import archive_manifest
from zsm3_tools.archive_manifest import album_issues, build, serialise
from zsm3_tools.archive_model import (
    Authorization,
    Conversion,
    Inventory,
    Settings,
    SourceAlbum,
    SourcePhoto,
    Variant,
    source_id,
)
from zsm3_tools.archive_permissions import Decision, Permissions
from zsm3_tools.archive_pipeline import PhotoResult

BAL = SourceAlbum("2019-2020/Bal", "2019/2020", "Bal", "bal")
BARE = SourceAlbum("Różne", None, "Różne", "rozne")
OK = Decision(Authorization.APPROVED, "zgoda", "DOC-1", "Uczniowie na sali")


def result(
    path: str, album: str | None, source: str, large: str | None = None, error: str | None = None
) -> PhotoResult:
    variant = None if error else Variant(1600, 1200, 1000)
    small = None if error else Variant(400, 300, 100)
    conversion = Conversion(source, None if error else "JPEG", error, variant, small, large)
    return PhotoResult(
        SourcePhoto(path, album, "jpg", 10), source_id(path), conversion, reused=False
    )


def outcomes(
    results: list[PhotoResult], permissions: Permissions
) -> dict[str, tuple[object, object, object]]:
    inventory = Inventory((BAL, BARE), tuple(r.photo for r in results), ())
    manifest = build(inventory, results, permissions, Settings(), "synthetic")
    photos = manifest["photos"]
    assert isinstance(photos, list)
    return {p["source_path"]: (p["outcome"], p["reasons"], p["duplicate_of"]) for p in photos}


def test_every_photo_gets_exactly_one_outcome() -> None:
    results = [
        result("2019-2020/Bal/a.jpg", BAL.path, "s1", "l1"),
        result("2019-2020/Bal/b.jpg", BAL.path, "s1", "l1"),
        result("2019-2020/Bal/c.jpg", BAL.path, "s3", "l1"),
        result("2019-2020/Bal/d.jpg", BAL.path, "s4", error="corrupt"),
        result("2019-2020/Bal/e.jpg", BAL.path, "s5", "l5"),
        result("2019-2020/Bal/f.jpg", BAL.path, "s6", "l6"),
        result("2019-2020/Bal/g.jpg", BAL.path, "s7", "l7"),
        result("Różne/h.jpg", BARE.path, "s8", "l8"),
        result("luzne.jpg", None, "s9", "l9"),
        result("2019-2020/Bal/i.jpg", BAL.path, "s4", error="corrupt"),
    ]
    permissions = Permissions(
        {BAL.path: Decision(Authorization.APPROVED, "zgoda", "DOC-1"), BARE.path: OK},
        {
            "2019-2020/Bal/a.jpg": OK,
            "2019-2020/Bal/e.jpg": Decision(Authorization.REJECTED, "sprzeciw"),
            "2019-2020/Bal/f.jpg": Decision(Authorization.UNKNOWN),
            "Różne/h.jpg": OK,
            "luzne.jpg": OK,
        },
    )

    found = outcomes(results, permissions)

    primary = source_id("2019-2020/Bal/a.jpg")
    assert found == {
        "2019-2020/Bal/a.jpg": ("eligible", [], None),
        "2019-2020/Bal/b.jpg": ("duplicate", ["same_photo"], primary),
        "2019-2020/Bal/c.jpg": ("duplicate", ["same_photo"], primary),
        "2019-2020/Bal/d.jpg": ("invalid", ["corrupt"], None),
        "2019-2020/Bal/e.jpg": ("rejected", [], None),
        "2019-2020/Bal/f.jpg": ("missing_permission", [], None),
        "2019-2020/Bal/g.jpg": ("incomplete", ["missing_alt"], None),
        "Różne/h.jpg": ("incomplete", ["missing_school_year"], None),
        "luzne.jpg": ("incomplete", ["no_album"], None),
        "2019-2020/Bal/i.jpg": ("invalid", ["corrupt"], source_id("2019-2020/Bal/d.jpg")),
    }


def test_nothing_is_eligible_without_a_permission_file() -> None:
    found = outcomes([result("2019-2020/Bal/a.jpg", BAL.path, "s1", "l1")], Permissions())

    assert found["2019-2020/Bal/a.jpg"][0] == "missing_permission"


def test_an_album_never_takes_more_photos_than_the_gallery_allows(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(archive_manifest, "MAX_ALBUM_PHOTOS", 2)
    results = [result(f"2019-2020/Bal/{n}.jpg", BAL.path, f"s{n}", f"l{n}") for n in range(3)]
    photos = {r.photo.path: OK for r in results}

    found = outcomes(results, Permissions({}, photos))

    assert [value[0] for value in found.values()] == ["eligible", "eligible", "incomplete"]
    assert found["2019-2020/Bal/2.jpg"][1] == ["album_full"]


def test_album_issues_name_every_missing_field() -> None:
    assert album_issues(None) == ["no_album"]
    assert album_issues(SourceAlbum("x", None, None, None)) == [
        "missing_school_year",
        "missing_slug",
        "missing_title",
    ]
    assert album_issues(BAL) == []


def test_the_manifest_is_versioned_ordered_and_reproducible() -> None:
    results = [result("2019-2020/Bal/a.jpg", BAL.path, "s1", "a" * 64)]
    inventory = Inventory((BAL,), tuple(r.photo for r in results), ())
    manifest = build(
        inventory, results, Permissions({}, {"2019-2020/Bal/a.jpg": OK}), Settings(), "x"
    )

    data = serialise(manifest)

    assert data == serialise(json.loads(data))
    assert data.endswith(b"\n")
    assert manifest["dry_run"] is True
    assert manifest["schema_version"] == 1
    [photo] = json.loads(data)["photos"]
    assert photo["planned_keys"] == {
        "large": f"g/{'a' * 64}-l.webp",
        "small": f"g/{'a' * 64}-s.webp",
    }
    assert photo["source_url"] is None
    [album] = json.loads(data)["albums"]
    assert (album["eligible_count"], album["photo_count"], album["authorization"]) == (
        1,
        1,
        "unknown",
    )
