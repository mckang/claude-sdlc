---
argument-hint: [description] [--emergency] [--dry-run]
description: 프로덕션 긴급 수정 — 기본(당일 패치) 또는 --emergency(즉각 대응) 두 모드 지원
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Hotfix

사용자가 `/sdlc:hotfix [description] [--emergency] [--dry-run]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:hotfix                                  # 기본 모드, description 대화 수집
/sdlc:hotfix login-timeout-fix                # 기본 모드, description 지정
/sdlc:hotfix login-timeout-fix --emergency    # 긴급 모드
/sdlc:hotfix login-timeout-fix --dry-run      # 문서 구조만 생성
```

## 1단계: 인자 파싱

```bash
MODE="standard"   # 기본값
DRY_RUN=false
POS_ARGS=()

for a in "$@"; do
  case "$a" in
    --emergency) MODE="emergency" ;;
    --dry-run)   DRY_RUN=true ;;
    --*)         echo "⚠️ 알 수 없는 플래그: $a" ;;
    *)           POS_ARGS+=("$a") ;;
  esac
done

DESCRIPTION="${POS_ARGS[0]:-}"
TODAY=$(date +%Y-%m-%d)
```

### description 수집

`DESCRIPTION` 이 비어 있으면 사용자에게 묻는다:

```
어떤 문제가 발생했나요? 한 줄로 설명해 주세요 (예: login-timeout-fix):
```

응답을 받아 공백을 하이픈으로 치환해 `$DESCRIPTION` 에 저장한다.

```bash
DESCRIPTION=$(echo "$DESCRIPTION" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
```

### 영향 범위 수집

```
영향받는 사용자/기능은 무엇인가요? (간단히):
```

응답을 `$IMPACT` 에 저장한다.

### Current Feature push

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" push "hotfix/${DESCRIPTION}"
```

이 명령은 현재 current feature를 Feature Stack에 저장하고, current feature를 `hotfix/<description>` 으로 설정한다.

### 산출물 경로 설정

```bash
RELEASE_DOC="${CLAUDE_PROJECT_DIR}/docs/releases/hotfix-${DESCRIPTION}-${TODAY}.md"
mkdir -p "${CLAUDE_PROJECT_DIR}/docs/releases"
```

### dry-run 모드 안내

`DRY_RUN=true` 이면 아래 메시지 출력:

```
🔍 dry-run 모드: 실제 파일 상태 확인 없이 문서 구조만 생성합니다.
```
