#!/usr/bin/env bash
set -euo pipefail

output="${GITHUB_OUTPUT:?}"
all='["apps/worker","apps/web","packages/contracts"]'

if [[ "${EVENT_NAME:-}" != "pull_request" ]]; then
  echo "packages=${all}" >>"${output}"
  exit 0
fi

changed="$(git diff --name-only HEAD^1 HEAD)"
shared='^(package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig\.base\.json|\.node-version|packages/contracts/|\.github/workflows/ci\.yml|\.github/actions/setup/|\.github/scripts/mutation-scope\.sh)'
web='^apps/web/(src/lib/|worker/|test/|stryker\.config\.json|vitest\.config\.ts|package\.json|tsconfig\.json)'

if grep -qE "${shared}" <<<"${changed}"; then
  echo "packages=${all}" >>"${output}"
  exit 0
fi

selected=()
if grep -qE '^apps/worker/' <<<"${changed}"; then
  selected+=('"apps/worker"')
fi
if grep -qE "${web}" <<<"${changed}"; then
  selected+=('"apps/web"')
fi

joined="$(IFS=,; echo "${selected[*]-}")"
echo "packages=[${joined}]" >>"${output}"
echo "Mutation scope: [${joined}]"
