#!/usr/bin/env bash
# SDLC plugin SessionStart hook: check if the project is initialized.
# Does NOT auto-create files — only prints guidance.

set -euo pipefail

PROJECT_DIR="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# If docs/ structure looks uninitialized, suggest running /sdlc:init
if [ ! -d "$PROJECT_DIR/docs/plans" ] || [ ! -d "$PROJECT_DIR/docs/standards" ]; then
  cat <<'EOF'
[sdlc plugin] 이 프로젝트는 아직 초기화되지 않았습니다.
           /sdlc:init 을 실행해 docs/ 트리와 표준 문서를 설치하세요.
EOF
fi

exit 0
