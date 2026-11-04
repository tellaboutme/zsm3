import json
from pathlib import Path

import pytest

from zsm3_tools import archive_permissions
from zsm3_tools.archive_model import Authorization
from zsm3_tools.archive_permissions import (
    UNKNOWN,
    Decision,
    Permissions,
    PermissionsError,
    load_permissions,
)

APPROVED = {"status": "approved", "basis": "zgoda rodziców", "reference": "DOC-2026-7"}


def document(tmp_path: Path, content: object) -> Path:
    path = tmp_path / "permissions.json"
    path.write_text(json.dumps(content, ensure_ascii=False), encoding="utf-8")
    return path


def test_without_a_file_everything_is_unknown() -> None:
    permissions = load_permissions(None)

    assert permissions.for_album("2019-2020/Bal") == UNKNOWN
    assert permissions.for_album(None) == UNKNOWN
    assert permissions.for_photo("2019-2020/Bal/a.jpg", "2019-2020/Bal") == UNKNOWN


def test_photo_decisions_refine_album_decisions(tmp_path: Path) -> None:
    path = document(
        tmp_path,
        {
            "version": 1,
            "albums": [
                {"path": "2019-2020/Bal", **APPROVED},
                {"path": "2019-2020/Obóz", "status": "rejected", "basis": "brak zgody"},
            ],
            "photos": [
                {"path": "2019-2020/Bal/a.jpg", "alt": "Uczniowie na sali"},
                {"path": "2019-2020/Bal/b.jpg", "status": "rejected", "basis": "sprzeciw"},
                {"path": "2019-2020/Obóz/c.jpg", **APPROVED, "alt": "Namioty"},
                {"path": "luzne/d.jpg", **APPROVED, "alt": "Boisko"},
            ],
        },
    )

    permissions = load_permissions(path)

    assert permissions.for_photo("2019-2020/Bal/a.jpg", "2019-2020/Bal") == Decision(
        Authorization.APPROVED, "zgoda rodziców", "DOC-2026-7", "Uczniowie na sali"
    )
    assert permissions.for_photo("2019-2020/Bal/b.jpg", "2019-2020/Bal").status is (
        Authorization.REJECTED
    )
    assert permissions.for_photo("2019-2020/Bal/z.jpg", "2019-2020/Bal").alt is None
    camp = permissions.for_photo("2019-2020/Obóz/c.jpg", "2019-2020/Obóz")
    assert (camp.status, camp.alt) == (Authorization.REJECTED, "Namioty")
    assert permissions.for_photo("luzne/d.jpg", None).status is Authorization.APPROVED


@pytest.mark.parametrize(
    ("content", "message"),
    [
        ([], "expected version 1"),
        ({"version": 2}, "expected version 1"),
        ({"version": 1, "extra": []}, "expected version 1"),
        ({"version": 1, "albums": {}}, "must be a list"),
        ({"version": 1, "albums": ["x"]}, "needs a path"),
        ({"version": 1, "albums": [{"status": "approved"}]}, "needs a path"),
        ({"version": 1, "albums": [{"path": "a", "who": "x"}]}, "needs a path"),
        ({"version": 1, "albums": [{"path": "../a"}]}, "not a relative"),
        ({"version": 1, "albums": [{"path": "a", "status": "maybe"}]}, "maybe"),
        ({"version": 1, "albums": [{"path": "a", "status": "approved"}]}, "documented basis"),
        ({"version": 1, "albums": [{"path": "a", "basis": " "}]}, "non-empty string"),
        ({"version": 1, "albums": [{"path": "a", "basis": 3}]}, "non-empty string"),
        ({"version": 1, "photos": [{"path": "a", "alt": "x" * 301}]}, "longer than 300"),
        ({"version": 1, "photos": [{"path": "a"}, {"path": "a"}]}, "listed twice"),
    ],
)
def test_malformed_permission_files_are_refused(
    tmp_path: Path, content: object, message: str
) -> None:
    with pytest.raises(PermissionsError, match=message):
        load_permissions(document(tmp_path, content))


def test_oversized_or_undecodable_files_are_refused(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    broken = tmp_path / "broken.json"
    broken.write_bytes(b"\xff{")
    with pytest.raises(PermissionsError, match="not valid UTF-8 JSON"):
        load_permissions(broken)
    monkeypatch.setattr(archive_permissions, "MAX_PERMISSION_BYTES", 1)
    with pytest.raises(PermissionsError, match="larger than"):
        load_permissions(broken)


def test_an_empty_permissions_object_grants_nothing() -> None:
    assert Permissions().for_photo("a/b.jpg", "a") == UNKNOWN
