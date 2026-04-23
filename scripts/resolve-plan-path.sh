#!/usr/bin/env bash
# Resolve feature NAME and plan file PATH from an optional single argument.
#
# Usage:
#   OUT=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-plan-path.sh" "$ARG") || exit 1
#   NAME=$(sed -n 1p <<<"$OUT")
#   PLAN=$(sed -n 2p <<<"$OUT")
#
# Arg semantics:
#   empty      → use Current Feature from CLAUDE.md (via resolve-current-feature.sh)
#   file path  → existing file, NAME derived by stripping `plan-` prefix from basename
#   name       → resolved as ${CLAUDE_PROJECT_DIR}/docs/plans/plan-<name>.md
#
# Output:
#   stdout: two lines — NAME\nPLAN\n
#   stderr: error message when resolution fails
# Exit: 0 success, 1 failure

set -euo pipefail

ARG="${1:-}"
PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"
PLUGIN_ROOT="${CLAUDE_PLUGIN_ROOT:-}"

if [ -z "$ARG" ]; then
  if [ -z "$PLUGIN_ROOT" ]; then
    echo "❌ CLAUDE_PLUGIN_ROOT 미설정 — 플러그인 환경에서만 동작합니다." >&2
    exit 1
  fi
  NAME=$(bash "$PLUGIN_ROOT/scripts/resolve-current-feature.sh")
  if [ -z "$NAME" ]; then
    echo "❌ 이름 인자 없음 + Current Feature 없음. /sdlc:feature <이름> 먼저 실행하세요." >&2
    exit 1
  fi
  PLAN="$PROJECT_DIR/docs/plans/plan-$NAME.md"
elif [ -f "$ARG" ]; then
  PLAN="$ARG"
  NAME=$(basename "$PLAN" .md | sed 's/^plan-//')
else
  NAME="$ARG"
  PLAN="$PROJECT_DIR/docs/plans/plan-$NAME.md"
fi

printf '%s\n%s\n' "$NAME" "$PLAN"
