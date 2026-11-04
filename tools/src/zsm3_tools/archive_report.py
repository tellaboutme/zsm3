from collections import Counter

from zsm3_tools.archive_model import Outcome

Json = dict[str, object]

MEANINGS = {
    Outcome.INVALID: "could not be converted; see the reason",
    Outcome.DUPLICATE: "the same photo appears earlier; only the first copy can be imported",
    Outcome.REJECTED: "permission was refused",
    Outcome.MISSING_PERMISSION: "no documented permission yet; nothing is inferred",
    Outcome.INCOMPLETE: "approved, but album or alt metadata is missing",
    Outcome.ELIGIBLE: "technically valid, approved and complete: eligible for a future import",
}


def _rows(manifest: Json, key: str) -> list[Json]:
    value = manifest.get(key)
    return [item for item in value if isinstance(item, dict)] if isinstance(value, list) else []


def _strings(value: object) -> list[str]:
    return [str(item) for item in value] if isinstance(value, list) else []


def _cell(value: object) -> str:
    return str(value).replace("|", "\\|").replace("\n", " ")


def markdown(manifest: Json, problems: list[str]) -> bytes:
    photos, albums, ignored = (_rows(manifest, key) for key in ("photos", "albums", "ignored"))
    outcomes = Counter(str(photo.get("outcome")) for photo in photos)
    reasons = Counter(reason for photo in photos for reason in _strings(photo.get("reasons")))
    lines = [
        "# Gallery archive dry run",
        "",
        "DRY RUN ONLY. Nothing was uploaded to R2 or written to D1.",
        "",
        f"Albums: {len(albums)}. Photos: {len(photos)}. Ignored entries: {len(ignored)}.",
        "",
        "| Outcome | Photos | Meaning |",
        "| --- | ---: | --- |",
    ]
    lines += [f"| {o.value} | {outcomes[o.value]} | {MEANINGS[o]} |" for o in Outcome]
    lines += ["", "## Reasons", "", "| Reason | Photos |", "| --- | ---: |"]
    lines += [f"| {_cell(reason)} | {count} |" for reason, count in sorted(reasons.items())]
    lines += ["", "## Albums", "", "| Album | Year | Permission | Eligible | Issues |"]
    lines += ["| --- | --- | --- | ---: | --- |"]
    lines += [
        f"| {_cell(a.get('album_path'))} | {_cell(a.get('school_year') or '?')} | "
        f"{_cell(a.get('authorization'))} | {a.get('eligible_count')}/{a.get('photo_count')} | "
        f"{_cell(', '.join(_strings(a.get('issues'))) or '-')} |"
        for a in albums
    ]
    ignored_reasons = Counter(str(item.get("reason")) for item in ignored)
    lines += ["", "## Ignored entries", "", "| Reason | Entries |", "| --- | ---: |"]
    lines += [f"| {_cell(reason)} | {n} |" for reason, n in sorted(ignored_reasons.items())]
    lines += ["", "## Validation", ""]
    lines += [f"- {_cell(problem)}" for problem in problems] or ["No problems in eligible records."]
    return ("\n".join(lines) + "\n").encode()
