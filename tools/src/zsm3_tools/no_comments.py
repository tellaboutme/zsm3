import io
import sys
import tokenize
from collections.abc import Iterator, Sequence
from dataclasses import dataclass
from pathlib import Path

USAGE_ERROR = 2


@dataclass(frozen=True, slots=True)
class CommentViolation:
    path: Path
    line: int
    column: int

    def describe(self) -> str:
        return f"{self.path}:{self.line}:{self.column + 1}: comments are not allowed"


def comment_positions(source: bytes) -> Iterator[tuple[int, int]]:
    for token in tokenize.tokenize(io.BytesIO(source).readline):
        if token.type == tokenize.COMMENT and not _is_shebang(token):
            yield token.start


def find_comments(path: Path) -> Iterator[CommentViolation]:
    for line, column in comment_positions(path.read_bytes()):
        yield CommentViolation(path, line, column)


def _is_shebang(token: tokenize.TokenInfo) -> bool:
    return token.start == (1, 0) and token.string.startswith("#!")


def python_files(roots: Sequence[Path]) -> Iterator[Path]:
    for root in roots:
        if root.is_file():
            yield root
        else:
            yield from sorted(root.rglob("*.py"))


def main(argv: Sequence[str] | None = None) -> int:
    arguments = sys.argv[1:] if argv is None else argv
    if not arguments:
        sys.stderr.write("usage: zsm3-no-comments PATH [PATH ...]\n")
        return USAGE_ERROR
    problems = [
        problem
        for path in python_files([Path(argument) for argument in arguments])
        for problem in _problems_in(path)
    ]
    for problem in problems:
        sys.stdout.write(f"{problem}\n")
    return 1 if problems else 0


def _problems_in(path: Path) -> list[str]:
    try:
        return [violation.describe() for violation in find_comments(path)]
    except (tokenize.TokenError, SyntaxError) as error:
        return [f"{path}: cannot tokenize: {error}"]
