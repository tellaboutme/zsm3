#!/usr/bin/env bash
set -euo pipefail

readonly markers='claude|anthropic|chatgpt|openai|co-authored-by|generated with'

readonly zero_sha="0000000000000000000000000000000000000000"

case "${EVENT_NAME:-}" in
  pull_request)
    base="${BASE_SHA:-}"
    ;;
  push)
    base="${BEFORE_SHA:-}"
    ;;
  *)
    base=""
    ;;
esac

if [[ -n "${base}" && "${base}" != "${zero_sha}" ]] && git rev-parse --quiet --verify "${base}" > /dev/null; then
  messages="$(git log --format=%B "${base}..HEAD")"
else
  messages="$(git log --format=%B -1)"
fi

if printf '%s' "${messages}" | grep -qiE "${markers}"; then
  printf 'a commit message in this range mentions AI assistance\n' >&2
  exit 1
fi
