# Gallery archive dry run

`zsm3-gallery-archive` prepares the old school photo archive for the gallery from PR #72
**without importing anything**. It reads a local folder, converts each photo into the two
WebP variants the gallery API accepts, applies an explicit permission file and writes a
manifest and a report. It has no upload or D1 command, never opens a network connection and
never modifies the source files.

```powershell
uv run --directory tools --locked zsm3-gallery-archive dry-run --source D:\archiwum --out "$env:LOCALAPPDATA\Temp\zsm3-gallery" --permissions D:\zgody\permissions.json
uv run --directory tools --locked zsm3-gallery-archive dry-run --source D:\archiwum --out "$env:LOCALAPPDATA\Temp\zsm3-gallery" --resume
uv run --directory tools --locked zsm3-gallery-archive validate --manifest "$env:LOCALAPPDATA\Temp\zsm3-gallery\manifest.json" --variants "$env:LOCALAPPDATA\Temp\zsm3-gallery\variants"
```

## Stages

| Stage         | Module                | What it does                                                                                                                                                                                                                                                                                                                                                                                                                     |
| ------------- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Source checks | `archive_paths`       | the source is a real directory; the output lies outside the repository, does not overlap the source and is either new or an earlier run resumed with `--resume`                                                                                                                                                                                                                                                                  |
| Discovery     | `archive_discovery`   | walks the folder without following links or junctions, at most `--max-depth` levels and `--max-files` photos; classifies photos, hidden and system files, archives and other files; reads a school year (`2019-2020`, `2019_20`, `2019 2020 – …`) and a title from folder names, folds Polish letters into a slug candidate                                                                                                      |
| Conversion    | `archive_images`      | per photo: bounded read, content-based format check (JPEG, PNG, WebP, GIF, BMP, TIFF), pixel limit, EXIF orientation, a fresh image without metadata, large variant with the long edge at most 1600 px, small variant with the long edge exactly 400 px, deterministic WebP (quality 82, method 4) stepping down to quality 50 to stay within 1.5 MB, then a check that only `VP8`, `VP8L`, `VP8X` and `ALPH` chunks are present |
| Checkpoints   | `archive_store`       | a JSON record per photo and the variants under their SHA-256, each written to a hidden `.partial` file and renamed; a record is reused only when the source hash, the settings and both variant files still match                                                                                                                                                                                                                |
| Permissions   | `archive_permissions` | album and photo decisions from `--permissions`; the default is `unknown`; `approved` needs a written basis and a reference                                                                                                                                                                                                                                                                                                       |
| Manifest      | `archive_manifest`    | duplicates, outcome per photo, planned R2 keys, deterministic JSON                                                                                                                                                                                                                                                                                                                                                               |
| Validation    | `archive_validate`    | the eligible records against the gallery contract and the 0014 D1 schema, and the variant files                                                                                                                                                                                                                                                                                                                                  |
| Report        | `archive_report`      | counts by outcome and reason, one line per album; no photo file names, alt texts or permission details                                                                                                                                                                                                                                                                                                                           |

## Inputs

- **Source folder.** Any layout works. A folder that directly holds photos is an album; a
  school year comes from the album folder or the nearest parent that names two consecutive
  years. Nothing else is guessed: a missing year, title or slug stays `null` and blocks the
  album until someone supplies it. ZIP and other archives are listed, not opened; HEIC is
  listed and refused, because Pillow cannot read it without an extra plug-in.
- **Permission file** (JSON, version 1, at most 10 MB, never committed):

  ```json
  {
    "version": 1,
    "albums": [
      {
        "path": "2019-2020/Dzień Sportu",
        "status": "approved",
        "basis": "zgoda rodziców z 2019 r.",
        "reference": "SEK/123/2019"
      }
    ],
    "photos": [
      {
        "path": "2019-2020/Dzień Sportu/IMG_0012.jpg",
        "alt": "Uczniowie na boisku podczas sztafety"
      },
      {
        "path": "2019-2020/Dzień Sportu/IMG_0013.jpg",
        "status": "rejected",
        "basis": "sprzeciw rodzica"
      }
    ]
  }
  ```

  A photo decision overrides its album, except that a rejected album rejects every photo in
  it. Alt text is written by a person and is required by the gallery, so it lives here.

## Outcomes

| Outcome              | Meaning                                                                                                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `invalid`            | the conversion failed; `reasons` names why (`corrupt`, `too_small`, `animated`, `too_many_pixels`, `unsupported_or_corrupt`, `variant_too_large`, `source_too_large`, `missing_source`, `link_not_followed`, `changed_during_run`) |
| `duplicate`          | the same source bytes or the same large variant appear at an earlier path; D1 keeps one row per hash, so only the first copy can be imported                                                                                       |
| `rejected`           | permission was refused                                                                                                                                                                                                             |
| `missing_permission` | no documented permission; a photo being public on the old site is not permission                                                                                                                                                   |
| `incomplete`         | approved, but the album lacks a school year, title or slug, the photo lacks alt text, it is not in an album, or the album already has 1000 eligible photos                                                                         |
| `eligible`           | valid, unique, approved and complete; it could be imported later, once an import exists                                                                                                                                            |

## Output folder

```text
<out>/
  .gallery-archive-run        settings of the run that created the folder
  manifest.json               versioned, deterministic, no timestamps
  report.md                   counts and album lines only
  records/<source id>.json    one checkpoint per photo
  variants/<sha256>-l.webp    large variant, named like its planned R2 key g/<sha256>-l.webp
  variants/<sha256>-s.webp    small variant
```

The output holds folder and file names of the archive, which can contain names of people,
so it must stay outside the repository; the tool refuses a path inside it.

## Manifest (schema 1)

Top level: `schema_version`, `dry_run: true`, `processing` (tool version, Pillow version,
WebP quality and method, edge and size limits), `source` (`local_directory` and a label, never
an absolute path), `summary`, `albums`, `photos`, `ignored`. Each photo holds `source_id`
(SHA-256 of the relative path, 32 hex characters), `source_path`, `source_url` (`null` for
local files), `album_path`, `source_sha256`, `source_format`, `conversion`, `large` and
`small` (`width`, `height`, `size_bytes`), `large_sha256`, `planned_keys`, `duplicate_of`,
`authorization` with its basis and reference, `alt`, `outcome` and `reasons`. The same inputs,
settings and Pillow version give a byte-identical manifest.

## Resume and failures

Every photo is converted on its own; a failure becomes an `invalid` record and the run goes
on. An interrupted run (Ctrl+C, crash, power loss) leaves only complete records, because
records are written after both variants and every file is renamed into place; leftover
`.partial` files are deleted on the next start. `--resume` hashes every source again, reuses
records whose source and settings match and whose variants are intact, and converts the rest.
A changed source file is converted again. Memory use is one photo at a time: the source bytes
(at most `--max-source-bytes`, 50 MB by default) and its decoded pixels (at most
`--max-pixels`, 80 megapixels by default).

## Not included

- **Crawling the old website** is not implemented. It would need its own robots-aware,
  rate-limited and SSRF-safe fetcher and a review of what the old site shows; it is a
  separate, gated feature.
- **Uploading.** There is no R2 or D1 command. A later import would have to read a validated
  manifest and go through the gallery API from PR #72 (which writes R2 first, then D1, and
  records `consent_by` and `consent_at`), behind its own review.
