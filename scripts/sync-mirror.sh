#!/usr/bin/env bash
# sync-mirror — upload the derived image tiers to the OSS fallback mirror.
# Architecture and rationale: docs/china-image-mirror-plan.md.
#
# Only *.avif / *.webp files are uploaded: the base-named file is the 2048w
# tier, plus the -768/-1200 tiers. The multi-MB JPEG originals stay on
# GitHub Pages (the mirror is a cost-capped fallback; see the plan doc's
# "Cost guardrails").
#
# Prerequisites:
#   brew install aliyun-cli
#   aliyun configure   # RAM user AccessKey scoped to this bucket,
#                      # region cn-hangzhou
#
# Usage: scripts/sync-mirror.sh
# Idempotent: -u skips objects whose OSS copy is already up to date.

set -euo pipefail

BUCKET="${OSS_MIRROR_BUCKET:-oss://lyeutsaon}"
SRC_DIR="$(cd "$(dirname "$0")/.." && pwd)/assets/img"

if ! command -v aliyun >/dev/null 2>&1; then
    echo "sync-mirror: aliyun CLI not found — run: brew install aliyun-cli" >&2
    exit 1
fi

aliyun oss cp -r -u "$SRC_DIR/" "$BUCKET/assets/img/" \
    --include "*.avif" --include "*.webp"
