#!/usr/bin/env bash
# SDLC plugin PreToolUse hook
# Guards:
#   1. Block direct commits to main/master branch
#   2. Warn when Bash tool tries to write to docs/standards/ (standards are managed files)
#
# Input  : JSON on stdin  { "tool_name": "...", "tool_input": { ... } }
# Output : nothing (exit 0 = allow, exit 2 = block with message to stdout)

set -uo pipefail

INPUT=$(cat)
TOOL=$(printf '%s' "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_name',''))" 2>/dev/null || true)

# ── Guard 1: block commits to main/master ────────────────────────────────────
if [ "$TOOL" = "Bash" ]; then
  CMD=$(printf '%s' "$INPUT" | python3 -c "import sys,json; d=json.load(sys.stdin); print(d.get('tool_input',{}).get('command',''))" 2>/dev/null || true)

  if printf '%s' "$CMD" | grep -qE '^\s*git\s+commit'; then
    REPO="${CLAUDE_PROJECT_DIR:-$(pwd)}"
    BRANCH=$(git -C "$REPO" symbolic-ref --short HEAD 2>/dev/null || echo "")
    if [ "$BRANCH" = "main" ] || [ "$BRANCH" = "master" ]; then
      echo "🚫 [sdlc] main/master 브랜치에 직접 커밋은 금지입니다."
      echo "   Story 브랜치를 만들고 커밋하세요: git checkout -b feat/<story-id>"
      echo "   또는 /sdlc:story start <ID> <Plan> 으로 브랜치를 자동 생성하세요."
      exit 2
    fi
  fi

  # ── Guard 2: warn on writes to docs/standards/ ───────────────────────────
  if printf '%s' "$CMD" | grep -qE '(>|tee|write)\s.*docs/standards/'; then
    echo "⚠️  [sdlc] docs/standards/ 는 팀 표준 관리 디렉터리입니다."
    echo "   표준 변경은 /sdlc:meeting 으로 팀 합의 후 수행하세요."
    # warn only — do not block (exit 0)
  fi
fi

exit 0
