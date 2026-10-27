import shutil
import subprocess
import sys
from collections.abc import Callable, Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path

USAGE_ERROR = 2
BINARY_SNIFF_BYTES = 8000
CYRILLIC_START = 0x0400
CYRILLIC_END = 0x052F

AI_MARKERS = (
    "claude",
    "anthropic",
    "chatgpt",
    "openai",
    "co-authored-by",
    "generated with",
)

EXEMPT_PATHS = frozenset(
    {
        Path("CLAUDE.md"),
        Path("tools/src/zsm3_tools/repo_rules.py"),
        Path("tools/tests/test_repo_rules.py"),
        Path(".github/pull_request_template.md"),
        Path(".github/scripts/check-commit-messages.sh"),
    }
)

GENERATED_NAMES = frozenset({"worker-configuration.d.ts"})

ROBOTS_PATH = Path("apps/web/public/robots.txt")
ROBOTS_EXPECTED = "User-agent: *\nDisallow: /\n"
ROBOTS_REASON = 'robots.txt must stay "Disallow: /" until the stage 7 launch'
CYRILLIC_REASON = "contains Cyrillic text"

Runner = Callable[[Sequence[str]], str]


class GitError(RuntimeError):
    pass


@dataclass(frozen=True, slots=True)
class RuleViolation:
    location: str
    reason: str

    def describe(self) -> str:
        return f"{self.location}: {self.reason}"


def has_cyrillic(text: str) -> bool:
    return any(CYRILLIC_START <= ord(character) <= CYRILLIC_END for character in text)


def ai_marker_in(text: str) -> str | None:
    lowered = text.lower()
    return next((marker for marker in AI_MARKERS if marker in lowered), None)


def is_exempt(path: Path) -> bool:
    return path in EXEMPT_PATHS or path.name in GENERATED_NAMES


def is_binary(data: bytes) -> bool:
    return b"\x00" in data[:BINARY_SNIFF_BYTES]


def read_text(path: Path) -> str | None:
    try:
        data = path.read_bytes()
    except OSError:
        return None
    if is_binary(data):
        return None
    try:
        return data.decode("utf-8")
    except UnicodeDecodeError:
        return None


def content_violations(path: Path, text: str) -> Iterator[RuleViolation]:
    if is_exempt(path):
        return
    if has_cyrillic(text):
        yield RuleViolation(str(path), CYRILLIC_REASON)
    marker = ai_marker_in(text)
    if marker is not None:
        yield RuleViolation(str(path), f"mentions '{marker}'")


def readable_files(root: Path, paths: Sequence[Path]) -> Iterator[tuple[Path, str]]:
    for path in paths:
        text = read_text(root / path)
        if text is not None:
            yield path, text


def robots_violation(root: Path) -> RuleViolation | None:
    text = read_text(root / ROBOTS_PATH)
    return None if text == ROBOTS_EXPECTED else RuleViolation(str(ROBOTS_PATH), ROBOTS_REASON)


def scan_tree(root: Path, paths: Sequence[Path]) -> list[RuleViolation]:
    violations = [
        violation
        for path, text in readable_files(root, paths)
        for violation in content_violations(path, text)
    ]
    robots = robots_violation(root)
    return violations if robots is None else [*violations, robots]


def git_prefix() -> str:
    found = shutil.which("git")
    if found is None:
        message = "git is required to list tracked files"
        raise GitError(message)
    return found


def run_git(command: Sequence[str]) -> str:
    completed = subprocess.run(list(command), capture_output=True, encoding="utf-8", check=False)
    if completed.returncode != 0:
        message = completed.stderr.strip() or f"git exited with {completed.returncode}"
        raise GitError(message)
    return completed.stdout


def tracked_files(root: Path, runner: Runner = run_git) -> list[Path]:
    output = runner([git_prefix(), "-C", str(root), "ls-files"])
    return [Path(line) for line in output.splitlines() if line]


def main(argv: Sequence[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    if not arguments:
        sys.stderr.write("usage: zsm3-repo-rules ROOT\n")
        return USAGE_ERROR
    root = Path(arguments[0])
    violations = scan_tree(root, tracked_files(root))
    for violation in violations:
        sys.stdout.write(f"{violation.describe()}\n")
    return 1 if violations else 0
