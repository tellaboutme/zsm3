import csv
from dataclasses import dataclass
from pathlib import Path
from urllib.parse import urlsplit
from xml.etree import ElementTree as ET
from xml.etree.ElementTree import ParseError

CSV_HEADER = ("from_path", "to_path")


class SourceError(ValueError):
    pass


@dataclass(frozen=True, slots=True)
class SourceRow:
    raw_from: str
    raw_to: str
    origin: str


def read_rows(path: Path, target: str) -> list[SourceRow]:
    suffix = path.suffix.lower()
    if suffix == ".csv":
        return read_csv(path)
    if suffix == ".xml":
        return read_sitemap(path, target)
    message = f"{path}: unsupported source type, expected .csv or .xml"
    raise SourceError(message)


def read_csv(path: Path) -> list[SourceRow]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        try:
            rows = list(csv.reader(handle))
        except csv.Error as error:
            message = f"{path}: unreadable CSV: {error}"
            raise SourceError(message) from error
    if not rows:
        message = f"{path}: file is empty"
        raise SourceError(message)
    if tuple(rows[0]) != CSV_HEADER:
        message = f"{path}: first row must be {','.join(CSV_HEADER)}"
        raise SourceError(message)
    numbered = [(number, row) for number, row in enumerate(rows[1:], start=2) if row]
    columns = len(CSV_HEADER)
    malformed = next((row for _, row in numbered if len(row) != columns), None)
    if malformed is not None:
        message = f"{path}: every row must have exactly {columns} columns"
        raise SourceError(message)
    return [SourceRow(row[0], row[1], f"{path}:{number}") for number, row in numbered]


def read_sitemap(path: Path, target: str) -> list[SourceRow]:
    try:
        root = ET.parse(path).getroot()
    except ParseError as error:
        message = f"{path}: invalid XML: {error}"
        raise SourceError(message) from error
    if _local_name(root.tag) != "urlset":
        message = f"{path}: root element must be urlset"
        raise SourceError(message)
    return [
        SourceRow(_path_of(element.text or ""), target, f"{path}#{position}")
        for position, element in enumerate(root.iter(), start=1)
        if _local_name(element.tag) == "loc"
    ]


def _local_name(tag: str) -> str:
    return tag.rsplit("}", 1)[-1]


def _path_of(text: str) -> str:
    stripped = text.strip()
    try:
        return urlsplit(stripped).path
    except ValueError:
        return stripped
