#!/usr/bin/env bash
set -euo pipefail

readonly image="ghcr.io/google/osv-scanner@sha256:4f3b7e2c64b9d38a5febc5a7e4a3dfef1d1362f726dea7a2ef4762b46469fcd0"
readonly workdir="${RUNNER_TEMP:-$(mktemp -d)}/osv"

mkdir -p "${workdir}"
awk '/^---$/ { document = ""; next } { document = document $0 "\n" } END { printf "%s", document }' \
  pnpm-lock.yaml > "${workdir}/pnpm-lock.yaml"
grep -q '^importers:' "${workdir}/pnpm-lock.yaml"

docker run --rm \
  --volume "${PWD}:/src:ro" \
  --volume "${workdir}:/osv:ro" \
  "${image}" scan source \
  --lockfile /osv/pnpm-lock.yaml \
  --lockfile /src/tools/uv.lock
