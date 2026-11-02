import pytest

from zsm3_tools.inventory_robots import parse_rules

AGENT = "ZSM3ContentInventory/1.0"
ORIGIN = "https://www.zespolszkolmechanicznych.edu.pl"


def test_wildcard_and_end_anchor_block_matching_files_only() -> None:
    rules = parse_rules("User-agent: *\nDisallow: /*.pdf$\nAllow: /public/*.pdf$")
    assert not rules.can_fetch(AGENT, ORIGIN + "/private/paper.pdf")
    assert rules.can_fetch(AGENT, ORIGIN + "/private/paper.pdf/view")
    assert rules.can_fetch(AGENT, ORIGIN + "/public/paper.pdf")


def test_comment_only_line_does_not_end_agent_group() -> None:
    rules = parse_rules(
        "User-agent: *\n  # files remain private\nDisallow: /private/*.pdf$\n"
        "Allow: /private/public.pdf$"
    )
    assert not rules.can_fetch(AGENT, ORIGIN + "/private/secret.pdf")
    assert rules.can_fetch(AGENT, ORIGIN + "/private/secret.pdf/view")
    assert rules.can_fetch(AGENT, ORIGIN + "/private/public.pdf")


def test_specific_agent_takes_priority_and_equal_length_allows() -> None:
    rules = parse_rules(
        "User-agent: *\nDisallow: /\n\n"
        "User-agent: ZSM3ContentInventory\nDisallow: /articles/*\nAllow: /articles/safe$\n"
        "\nUser-agent: ZSM3ContentInventory\nDisallow: /articles/safe$"
    )
    assert rules.can_fetch(AGENT, ORIGIN + "/")
    assert not rules.can_fetch(AGENT, ORIGIN + "/articles/secret")
    assert rules.can_fetch(AGENT, ORIGIN + "/articles/safe")


def test_adjacent_user_agents_share_rules_and_comments_are_ignored() -> None:
    rules = parse_rules(
        "# header\nUser-agent: Other\nUser-agent: ZSM3ContentInventory\n"
        "Disallow: /private # never fetch\nAllow:\nSitemap: https://example.com/sitemap.xml"
    )
    assert not rules.can_fetch(AGENT, ORIGIN + "/private")
    assert rules.can_fetch(AGENT, ORIGIN + "/public")
    assert rules.can_fetch("Unrelated", ORIGIN + "/private")


def test_new_agent_after_rules_starts_new_group() -> None:
    rules = parse_rules(
        "User-agent: Other\nDisallow: /\nUser-agent: ZSM3ContentInventory\nAllow: /"
    )
    assert rules.can_fetch(AGENT, ORIGIN + "/")
    assert not rules.can_fetch("Other", ORIGIN + "/")


def test_blank_line_inside_group_keeps_rules() -> None:
    rules = parse_rules("User-agent: *\n\nDisallow: /private\n")
    assert not rules.can_fetch(AGENT, ORIGIN + "/private")


def test_agent_groups_match_the_product_token_only() -> None:
    rules = parse_rules("User-agent: content\nDisallow: /\n\nUser-agent: *\nAllow: /")
    assert rules.can_fetch(AGENT, ORIGIN + "/")
    exact = parse_rules("User-agent: zsm3contentinventory\nDisallow: /")
    assert not exact.can_fetch(AGENT, ORIGIN + "/")


def test_rules_match_percent_encoded_paths() -> None:
    rules = parse_rules("User-agent: *\nDisallow: /zajęcia")
    assert not rules.can_fetch(AGENT, ORIGIN + "/zaj%C4%99cia/plan")
    assert rules.can_fetch(AGENT, ORIGIN + "/zajecia")


def test_decimal_delay_and_request_rate_use_stricter_interval() -> None:
    rules = parse_rules("User-agent: *\nCrawl-delay: 2.5\nRequest-rate: 1/4")
    assert rules.delay == 4


@pytest.mark.parametrize(
    "text",
    [
        "NoColon",
        "User-agent:\nDisallow: /",
        "User-agent: *\nDisallow: private",
        "Sitemap: https://example.com/sitemap.xml",
        "User-agent: *\nCrawl-delay: NaN",
        "User-agent: *\nCrawl-delay: -2",
        "User-agent: *\nCrawl-delay: " + "9" * 400,
        "User-agent: *\nRequest-rate: 0/2",
        "User-agent: *\nRequest-rate: invalid",
    ],
)
def test_invalid_robots_is_rejected(text: str) -> None:
    with pytest.raises(ValueError, match=r"robots\.txt"):
        parse_rules(text)
