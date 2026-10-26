import pytest
from hypothesis import given
from hypothesis import strategies as st

from zsm3_tools.redirect_paths import (
    FROM_LENGTH_REASON,
    FROM_START_REASON,
    FROM_WHITESPACE_REASON,
    JAVASCRIPT_WHITESPACE,
    MAX_FROM_LENGTH,
    MAX_TO_LENGTH,
    SELF_REDIRECT_REASON,
    TO_LENGTH_REASON,
    TO_PATTERN_REASON,
    RedirectRow,
    RedirectRowError,
    javascript_length,
    normalise_from_path,
    parse_redirect_row,
)

URL_ALPHABET = "/abcxyz0123456789-'?&=."

VALID_CASES = [
    ("/", "/start"),
    ("//", "/start"),
    ("/Kontakt/", "/start"),
    ("/Aktualnosci", "/start"),
    ("/a-b/c-d", "/start"),
    ("/a?b=c#d", "/start"),
    ("/o'neil", "/start"),
    ("/01-wydarzenie", "/wydarzenia/01-wydarzenie"),
    ("/" + "a" * (MAX_FROM_LENGTH - 1), "/start"),
    ("/x", "/"),
    ("/x", "/" + "a" * (MAX_TO_LENGTH - 1)),
]

INVALID_CASES = [
    ("", "/x", FROM_START_REASON),
    ("x/y", "/x", FROM_START_REASON),
    ("a b", "/x", FROM_START_REASON),
    ("/a b", "/x", FROM_WHITESPACE_REASON),
    ("/a\t", "/x", FROM_WHITESPACE_REASON),
    ("/a\u000b", "/x", FROM_WHITESPACE_REASON),
    ("/a\u00a0", "/x", FROM_WHITESPACE_REASON),
    ("/a\ufeffb", "/x", FROM_WHITESPACE_REASON),
    ("/" + "a" * MAX_FROM_LENGTH, "/x", FROM_LENGTH_REASON),
    ("/x", "/" + "a" * MAX_TO_LENGTH, TO_LENGTH_REASON),
    ("/x", "a", TO_PATTERN_REASON),
    ("/x", "", TO_PATTERN_REASON),
    ("/x", "/A", TO_PATTERN_REASON),
    ("/x", "/a/", TO_PATTERN_REASON),
    ("/x", "/a//b", TO_PATTERN_REASON),
    ("/x", "/á", TO_PATTERN_REASON),
    ("/x", "/a b", TO_PATTERN_REASON),
    ("/x", "/a\n", TO_PATTERN_REASON),
    ("/A", "/a", SELF_REDIRECT_REASON),
    ("//", "/", SELF_REDIRECT_REASON),
]


@pytest.mark.parametrize(("raw_from", "raw_to"), VALID_CASES)
def test_accepts_rows_matching_the_typescript_contracts(raw_from: str, raw_to: str) -> None:
    row = parse_redirect_row(raw_from, raw_to)

    assert row == RedirectRow(normalise_from_path(raw_from), raw_to)
    assert row.from_path == row.from_path.lower()


@pytest.mark.parametrize(("raw_from", "raw_to", "reason"), INVALID_CASES)
def test_rejects_rows_with_the_matching_reason(raw_from: str, raw_to: str, reason: str) -> None:
    with pytest.raises(RedirectRowError) as raised:
        parse_redirect_row(raw_from, raw_to)

    assert str(raised.value) == reason


def test_normalising_mirrors_the_worker_rules() -> None:
    assert normalise_from_path("/Kontakt/") == "/kontakt"
    assert normalise_from_path("/") == "/"
    assert normalise_from_path("//") == "/"
    assert normalise_from_path("/a//") == "/a/"


def test_javascript_length_counts_utf_16_units() -> None:
    assert javascript_length("abc") == 3
    assert javascript_length("\U0001f600") == 2
    assert javascript_length("\ud800") == 1


def test_javascript_whitespace_covers_the_ecmascript_set() -> None:
    assert JAVASCRIPT_WHITESPACE.startswith("\t\n\v\f\r ")
    assert "\u00a0" in JAVASCRIPT_WHITESPACE
    assert "\ufeff" in JAVASCRIPT_WHITESPACE


@given(st.text(alphabet=URL_ALPHABET, max_size=40))
def test_source_paths_normalise_like_the_worker(value: str) -> None:
    raw = "/" + value

    assert parse_redirect_row(raw, "/start").from_path == normalise_from_path(raw)


@given(st.text())
def test_normalising_lowers_case_and_leaves_at_most_one_trailing_slash(value: str) -> None:
    normalised = normalise_from_path(value)

    assert normalised == normalised.lower()
    assert not normalised.endswith("//")


@given(st.text(max_size=20), st.sampled_from(JAVASCRIPT_WHITESPACE), st.text(max_size=20))
def test_any_javascript_whitespace_rejects_the_source_path(
    before: str, space: str, after: str
) -> None:
    with pytest.raises(RedirectRowError) as raised:
        parse_redirect_row("/" + before + space + after, "/x")

    assert str(raised.value) == FROM_WHITESPACE_REASON
