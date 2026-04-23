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

## 기본 모드 (MODE=standard)

`MODE=standard` 이면 아래 절차를 순서대로 따른다.

### 2단계: Phase 1 — 문제 정의 (기본 모드)

> 목적: hotfix 브랜치 전략을 안내하고 수정 준비를 돕는다.

다음 내용을 출력한다 (사용자가 직접 실행):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Hotfix 브랜치 생성 안내
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 명령어를 직접 실행하세요:

git checkout main && git pull origin main
git checkout -b hotfix/<DESCRIPTION>
```

(`<DESCRIPTION>` 자리에 실제 `$DESCRIPTION` 값을 출력한다.)

### 3단계: Phase 2 — 구현 & PR 체크리스트 (기본 모드)

> 목적: 수정 완료 및 머지까지 확인한다.

아래를 **출력하고 사용자 응답을 기다린다** (`DRY_RUN=false` 일 때):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Hotfix 구현 & PR 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 항목을 모두 확인했으면 "확인" 또는 "12345"를 입력하세요.
미완료 항목이 있으면 해당 번호와 사유를 알려주세요.

[ ] 1. hotfix 브랜치에서 수정 완료
[ ] 2. 로컬 테스트 통과
[ ] 3. 스테이징에서 검증 완료
[ ] 4. PR 생성 후 최소 1인 리뷰 & 승인 받음
[ ] 5. PR이 main에 머지됨
```

**사용자 응답 처리:**
- "확인", "12345", "모두", "all", "ok" → 5개 항목 전부 통과, `STD_CHECKLIST_RESULT="✅ 5/5 통과"` 기록, Phase 3 진행
- 미완료 항목 있음 → 해당 항목 명시 후 중단:

```
❌ 체크리스트 미완료: 항목 (번호)이 확인되지 않았습니다.
   → 해당 항목 완료 후 /sdlc:hotfix 를 다시 실행하세요.
```

**dry-run 모드:** 사용자 응답 없이 5개 항목 모두 `[ ]` 상태로 `STD_CHECKLIST_RESULT="[dry-run]"` 기록 후 계속 진행.
