import copy
import hashlib
from pathlib import Path

import pytest

from zsm3_tools.archive_validate import Json, album_problems, photo_problems, validate

SHA = "a" * 64


def photo(**changes: object) -> Json:
    base: Json = {
        "source_id": "p1",
        "album_path": "2019-2020/Bal",
        "outcome": "eligible",
        "authorization": "approved",
        "alt": "Uczniowie",
        "large_sha256": SHA,
        "large": {"width": 1600, "height": 1200, "size_bytes": 1000},
        "small": {"width": 400, "height": 300, "size_bytes": 100},
        "planned_keys": {"large": f"g/{SHA}-l.webp", "small": f"g/{SHA}-s.webp"},
    }
    base.update(changes)
    return base


def album(**changes: object) -> Json:
    base: Json = {
        "album_path": "2019-2020/Bal",
        "school_year": "2019/2020",
        "slug_candidate": "bal",
        "title_candidate": "Bal",
        "eligible_count": 1,
    }
    base.update(changes)
    return base


def manifest(photos: list[Json], albums: list[Json]) -> Json:
    return {"schema_version": 1, "dry_run": True, "photos": photos, "albums": albums}


def test_a_complete_eligible_record_has_no_problems() -> None:
    assert validate(manifest([photo(), photo(outcome="duplicate")], [album()])) == []


@pytest.mark.parametrize(
    ("changes", "problem"),
    [
        ({"large_sha256": "A" * 64}, "lowercase SHA-256"),
        ({"large": None}, "variant sizes missing"),
        ({"small": {"width": "400", "height": 300, "size_bytes": 1}}, "variant sizes missing"),
        ({"large": {"width": 1700, "height": 1200, "size_bytes": 1}}, "outside 400-1600"),
        ({"large": {"width": 1600, "height": 0, "size_bytes": 1}}, "outside 400-1600"),
        ({"small": {"width": 399, "height": 300, "size_bytes": 1}}, "small long edge"),
        ({"small": {"width": 400, "height": 200, "size_bytes": 1}}, "aspect ratio"),
        ({"small": {"width": 400, "height": 300, "size_bytes": 1_500_001}}, "1.5 MB"),
        ({"planned_keys": {"large": "x", "small": "y"}}, "planned R2 keys"),
        ({"alt": " "}, "alt text"),
        ({"authorization": "unknown"}, "without approval"),
    ],
)
def test_photo_records_are_checked_against_the_gallery_contract(
    changes: dict[str, object], problem: str
) -> None:
    assert any(problem in found for found in photo_problems(photo(**changes)))


@pytest.mark.parametrize(
    ("changes", "problem"),
    [
        ({"school_year": "2019/2021"}, "school year"),
        ({"school_year": None}, "school year"),
        ({"slug_candidate": "Bal"}, "slug"),
        ({"slug_candidate": "a" * 121}, "slug"),
        ({"title_candidate": ""}, "title"),
        ({"eligible_count": 1001}, "1000 photos"),
    ],
)
def test_album_records_are_checked_against_the_d1_schema(
    changes: dict[str, object], problem: str
) -> None:
    assert any(problem in found for found in album_problems(album(**changes)))


def test_cross_record_rules_and_foreign_documents() -> None:
    twin = photo(source_id="p2")
    clash = album(album_path="2019-2020/Inny")
    problems = validate(
        manifest(
            [
                photo(),
                twin,
                photo(
                    album_path=clash["album_path"],
                    source_id="p3",
                    large_sha256="b" * 64,
                    planned_keys={"large": f"g/{'b' * 64}-l.webp", "small": f"g/{'b' * 64}-s.webp"},
                ),
            ],
            [album(), clash, album(album_path="unused", slug_candidate="Zły")],
        )
    )

    assert f"photo hash {SHA} repeats" in problems
    assert "album slug bal repeats in 2019/2020" in problems
    assert not any("unused" in problem for problem in problems)
    assert validate({"schema_version": 1}) == ["not a dry-run manifest of schema 1"]
    assert validate({"schema_version": 1, "dry_run": True, "photos": {}, "albums": [3]}) == []


def test_variant_files_are_verified_when_given(tmp_path: Path) -> None:
    data = b"RIFF" + (14).to_bytes(4, "little") + b"WEBPVP8 " + (2).to_bytes(4, "little") + b"ab"
    sha = hashlib.sha256(data).hexdigest()
    record = photo(
        large_sha256=sha,
        planned_keys={"large": f"g/{sha}-l.webp", "small": f"g/{sha}-s.webp"},
    )
    document = manifest([record], [album()])

    assert validate(document, tmp_path) == ["photo p1: variant file missing"]
    (tmp_path / f"{sha}-l.webp").write_bytes(data)
    (tmp_path / f"{sha}-s.webp").write_bytes(b"not webp")
    assert validate(document, tmp_path) == ["photo p1: variant is not a plain WebP"]
    (tmp_path / f"{sha}-s.webp").write_bytes(data)
    assert validate(document, tmp_path) == []
    (tmp_path / f"{sha}-l.webp").write_bytes(data[:-1] + b"\1")
    broken = copy.deepcopy(document)
    assert validate(broken, tmp_path) == ["photo p1: large variant hash differs"]
