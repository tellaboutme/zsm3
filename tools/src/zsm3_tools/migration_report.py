import csv
import io
import json
from collections import Counter
from collections.abc import Sequence
from dataclasses import dataclass

from zsm3_tools.migration_audit import Category, Finding
from zsm3_tools.migration_cms import CmsFinding
from zsm3_tools.migration_inputs import Rejected

MANIFEST_VERSION = 1
MAX_LISTED = 200

MEANINGS: dict[Category, str] = {
    Category.MAPPED_LOOP: "redirect chain loops or exceeds 8 hops; the Worker serves 404",
    Category.MAPPED_TARGET_MISSING: "mapped, but the destination is not served",
    Category.MAPPED_UNENCODED: "the map row holds raw letters, so it never matches a request",
    Category.MAPPED_SHADOWED: "mapped, but the old path is itself served, so it never redirects",
    Category.MAPPED_CHAIN: "mapped through another redirect; collapse to the final destination",
    Category.MISSING: "no mapping and not served: needs a destination or a deliberate 404",
    Category.DOCUMENT_REVIEW: "document link; file paths are never redirected, review it",
    Category.NOT_REDIRECTABLE: "asset or reserved path the legacy lookup never handles",
    Category.UNRESOLVED: "listed as unresolved; needs content or a school decision",
    Category.UNVERIFIED: "matches only a dynamic route; probe a local preview to confirm",
    Category.MAPPED_UNVERIFIED: "mapped to a dynamic route; probe a local preview to confirm",
    Category.MAPPED: "redirects to a served destination",
    Category.LIVE_SAME_PATH: "served at the same path on the new site",
}

ACTIONS: dict[Category, str] = {
    Category.MAPPED_CHAIN: "collapse_chain",
    Category.MAPPED_SHADOWED: "remove_shadowed",
    Category.MAPPED_LOOP: "break_loop",
    Category.MAPPED_TARGET_MISSING: "choose_target",
    Category.MAPPED_UNENCODED: "encode_source",
}


@dataclass(frozen=True, slots=True)
class Report:
    findings: Sequence[Finding]
    cms: Sequence[CmsFinding]
    rejected: Sequence[Rejected]


def summary(findings: Sequence[Finding]) -> dict[str, int]:
    counts = Counter(finding.category for finding in findings)
    return {category.value: counts[category] for category in Category}


def manifest(report: Report) -> bytes:
    payload = {
        "version": MANIFEST_VERSION,
        "summary": summary(report.findings),
        "findings": [
            {
                "key": finding.key,
                "category": finding.category.value,
                "target": finding.target,
                "sources": list(finding.sources),
                "notes": list(finding.notes),
            }
            for finding in report.findings
        ],
        "cms": [
            {"path": item.path, "category": item.category.value, "route": item.route}
            for item in report.cms
        ],
        "rejected": [
            {"origin": item.origin, "value": item.value, "reason": item.reason}
            for item in report.rejected
        ],
    }
    return (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode()


def candidates(findings: Sequence[Finding]) -> bytes:
    buffer = io.StringIO()
    writer = csv.writer(buffer, lineterminator="\n")
    writer.writerow(("action", "from_path", "to_path"))
    for finding in findings:
        action = ACTIONS.get(finding.category)
        if action is not None:
            writer.writerow((action, finding.key, finding.target or ""))
    return buffer.getvalue().encode()


def _cell(value: str) -> str:
    return value.replace("|", "\\|").replace("`", "'")


def _section(category: Category, findings: Sequence[Finding]) -> list[str]:
    rows = [finding for finding in findings if finding.category is category]
    if not rows:
        return []
    lines = [f"## {category.value} ({len(rows)})", "", MEANINGS[category], ""]
    lines += ["| Old path | Destination | Notes |", "| --- | --- | --- |"]
    lines += [
        f"| `{_cell(row.key)}` | {_cell(row.target or '')} | {_cell(', '.join(row.notes))} |"
        for row in rows[:MAX_LISTED]
    ]
    if len(rows) > MAX_LISTED:
        lines.append(f"| … {len(rows) - MAX_LISTED} more in the manifest | | |")
    return [*lines, ""]


def markdown(report: Report) -> bytes:
    counts = summary(report.findings)
    lines = ["# Legacy migration audit", "", "Dry run: nothing was written to any database.", ""]
    lines += ["| Category | Paths | Meaning |", "| --- | --- | --- |"]
    lines += [f"| {c.value} | {counts[c.value]} | {MEANINGS[c]} |" for c in Category]
    lines.append("")
    for category in Category:
        lines += _section(category, report.findings)
    if report.cms:
        lines += ["## CMS pages the public site may not show", ""]
        lines += ["| Page | Finding | Route |", "| --- | --- | --- |"]
        lines += [f"| `{_cell(i.path)}` | {i.category.value} | {i.route} |" for i in report.cms]
        lines.append("")
    if report.rejected:
        lines += ["## Rejected input", "", "| Origin | Reason |", "| --- | --- |"]
        lines += [f"| {_cell(i.origin)} | {_cell(i.reason)} |" for i in report.rejected]
        lines.append("")
    return "\n".join(lines).encode()
