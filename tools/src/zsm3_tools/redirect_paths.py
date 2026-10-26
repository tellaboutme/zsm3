import re
from dataclasses import dataclass

MAX_FROM_LENGTH = 500
MAX_TO_LENGTH = 300

JAVASCRIPT_WHITESPACE = (
    "\t\n\v\f\r \u00a0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006"
    "\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
)

_WHITESPACE = re.compile("[" + re.escape(JAVASCRIPT_WHITESPACE) + "]")
_SITE_PATH = re.compile(r"/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:/[a-z0-9]+(?:-[a-z0-9]+)*)*)?")

FROM_START_REASON = "from path must start with /"
FROM_WHITESPACE_REASON = "from path must not contain whitespace"
FROM_LENGTH_REASON = f"from path is longer than {MAX_FROM_LENGTH} characters"
TO_LENGTH_REASON = f"to path is longer than {MAX_TO_LENGTH} characters"
TO_PATTERN_REASON = "to path must be an internal site path"
SELF_REDIRECT_REASON = "redirect must not point to itself"


class RedirectRowError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class RedirectRow:
    from_path: str
    to_path: str


def javascript_length(value: str) -> int:
    return len(value.encode("utf-16-le", "surrogatepass")) // 2


def normalise_from_path(value: str) -> str:
    trimmed = value[:-1] if len(value) > 1 and value.endswith("/") else value
    return trimmed.lower()


def parse_redirect_row(raw_from: str, raw_to: str) -> RedirectRow:
    if not raw_from.startswith("/"):
        raise RedirectRowError(FROM_START_REASON)
    if _WHITESPACE.search(raw_from) is not None:
        raise RedirectRowError(FROM_WHITESPACE_REASON)
    if javascript_length(raw_from) > MAX_FROM_LENGTH:
        raise RedirectRowError(FROM_LENGTH_REASON)
    if javascript_length(raw_to) > MAX_TO_LENGTH:
        raise RedirectRowError(TO_LENGTH_REASON)
    if _SITE_PATH.fullmatch(raw_to) is None:
        raise RedirectRowError(TO_PATTERN_REASON)
    from_path = normalise_from_path(raw_from)
    if from_path == raw_to:
        raise RedirectRowError(SELF_REDIRECT_REASON)
    return RedirectRow(from_path, raw_to)
