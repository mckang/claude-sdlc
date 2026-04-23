---
argument-hint: [Story ID | feature이름, 생략 시 current] [--story | --feature] [--dry-run]
description: Phase-Gate 릴리스 체크리스트 — Pre-release 검증 → Go/No-go 게이트 → 배포 안내 및 롤백 문서화
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 릴리스 (Release)

사용자가 `/release [Story ID | feature이름] [--story | --feature] [--dry-run]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:release                          # current feature 릴리스
/sdlc:release checkout-v2              # feature 이름 지정
/sdlc:release E1-S1 --story           # 단일 Story 릴리스
/sdlc:release checkout-v2 --dry-run   # 체크리스트 문서만 생성
```

## 1단계: 인자 파싱

```bash
# 플래그 파싱
MODE="feature"    # 기본값
DRY_RUN=false
POS_ARGS=()

for a in "$@"; do
  case "$a" in
    --story)   MODE="story" ;;
    --feature) MODE="feature" ;;
    --dry-run) DRY_RUN=true ;;
    --*)       echo "⚠️ 알 수 없는 플래그: $a" ;;
    *)         POS_ARGS+=("$a") ;;
  esac
done

FIRST_ARG="${POS_ARGS[0]:-}"

# E\d+-S\d+ 패턴이면 --story 자동 감지
if [[ "$FIRST_ARG" =~ ^E[0-9]+-S[0-9]+$ ]]; then
  MODE="story"
  STORY_ID="$FIRST_ARG"
fi
```

### Plan 경로 resolve

```bash
if [[ "$MODE" == "story" ]]; then
  # Story 모드: 두 번째 위치 인자 또는 current feature로 Plan resolve
  PLAN_ARG="${POS_ARGS[1]:-}"
else
  # Feature 모드: 첫 번째 위치 인자로 Plan resolve
  PLAN_ARG="${POS_ARGS[0]:-}"
fi

OUT=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-plan-path.sh" "$PLAN_ARG") || exit 1
NAME=$(sed -n 1p <<<"$OUT")
PLAN=$(sed -n 2p <<<"$OUT")
test -f "$PLAN" || { echo "❌ Plan 파일이 없습니다: $PLAN"; exit 1; }

TODAY=$(date +%Y-%m-%d)
RELEASE_DOC="${CLAUDE_PROJECT_DIR}/docs/releases/release-${NAME}-${TODAY}.md"
mkdir -p "${CLAUDE_PROJECT_DIR}/docs/releases"
```

### dry-run 모드 안내

`DRY_RUN=true` 이면 아래 메시지 출력 후 실제 파일 읽기·체크 없이 체크리스트 구조만 생성:

```
🔍 dry-run 모드: 실제 파일 상태 확인 없이 체크리스트 문서 구조만 생성합니다.
```
