import re
from dataclasses import dataclass
from urllib.parse import urlsplit

from zsm3_tools.inventory_http import encode_path


@dataclass(frozen=True, slots=True)
class Rule:
    pattern: str
    allow: bool

    def matches(self, path: str) -> bool:
        anchored = self.pattern.endswith("$")
        pattern = self.pattern[:-1] if anchored else self.pattern
        expression = re.escape(pattern).replace(r"\*", ".*")
        return re.match("^" + expression + ("$" if anchored else ""), path) is not None

    def specificity(self) -> int:
        return len(self.pattern.rstrip("$").replace("*", ""))


@dataclass(frozen=True, slots=True)
class Group:
    agents: tuple[str, ...]
    rules: tuple[Rule, ...]


@dataclass(frozen=True, slots=True)
class RobotsRules:
    groups: tuple[Group, ...]
    delay: float

    def can_fetch(self, agent: str, url: str) -> bool:
        product = agent.partition("/")[0].lower()
        matches = [
            (0 if crawler == "*" else 1, group)
            for group in self.groups
            for crawler in group.agents
            if crawler in ("*", product)
        ]
        if not matches:
            return True
        strongest = max(priority for priority, _ in matches)
        path = urlsplit(url).path
        matching_rules = [
            rule
            for priority, group in matches
            if priority == strongest
            for rule in group.rules
            if rule.matches(path)
        ]
        if not matching_rules:
            return True
        best = max(rule.specificity() for rule in matching_rules)
        return any(rule.allow for rule in matching_rules if rule.specificity() == best)


def _directive(line: str) -> tuple[str, str]:
    key, separator, value = line.partition(":")
    if not separator:
        message = "invalid robots.txt directive"
        raise ValueError(message)
    return key.strip().lower(), value.strip()


def _append_rule(rules: list[Rule], key: str, value: str) -> None:
    if not value.startswith("/"):
        message = "invalid robots.txt path"
        raise ValueError(message)
    rules.append(Rule(encode_path(value), key == "allow"))


def _agent(value: str) -> str:
    if not value:
        message = "empty robots.txt user-agent"
        raise ValueError(message)
    return value.lower()


def _pacing(key: str, value: str) -> float:
    if key == "crawl-delay" and re.fullmatch(r"\d+(?:\.\d+)?", value):
        delay = float(value)
        if delay < float("inf"):
            return delay
    if key == "request-rate" and re.fullmatch(r"[1-9]\d*/[1-9]\d*", value):
        requests, seconds = value.split("/")
        return int(seconds) / int(requests)
    message = "invalid robots.txt pacing directive"
    raise ValueError(message)


def parse_rules(text: str) -> RobotsRules:
    groups: list[Group] = []
    agents: list[str] = []
    rules: list[Rule] = []
    delay = 0.0

    def finish_group() -> None:
        if agents:
            groups.append(Group(tuple(agents), tuple(rules)))
        agents.clear()
        rules.clear()

    for raw in text.splitlines():
        line = raw.partition("#")[0].strip()
        if not line:
            continue
        key, value = _directive(line)
        if key == "user-agent":
            if rules:
                finish_group()
            agents.append(_agent(value))
        elif key in ("allow", "disallow") and agents and value:
            _append_rule(rules, key, value)
        elif key in ("crawl-delay", "request-rate"):
            delay = max(delay, _pacing(key, value))
    finish_group()
    if not groups:
        message = "robots.txt has no user-agent group"
        raise ValueError(message)
    return RobotsRules(tuple(groups), delay)
