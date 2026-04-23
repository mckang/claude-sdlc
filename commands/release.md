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

# --story 플래그를 명시했지만 STORY_ID가 설정되지 않은 경우 사용자에게 요청
if [[ "$MODE" == "story" && -z "${STORY_ID:-}" ]]; then
  echo "❓ Story ID를 입력해 주세요 (예: E1-S1):"
  read -r STORY_ID
  if [[ ! "$STORY_ID" =~ ^E[0-9]+-S[0-9]+$ ]]; then
    echo "❌ 올바르지 않은 Story ID 형식입니다: $STORY_ID (예: E1-S1)"
    exit 1
  fi
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

## 2단계: Phase 1 — Pre-release 검증

> 목적: 배포 전 기술적 준비 상태를 확인한다.

### 자동 수집

Plan 파일을 `Read` 로 읽어 다음 정보를 수집한다:

**Feature 모드(`--feature`):**

미완료 Story 체크: Plan 파일에서 `- [ ]` 또는 `- [~]` 마커가 붙은 Story 라인을 찾는다.
미완료 Story가 1개라도 있으면:

```
❌ Phase 1 실패: 미완료 Story가 있습니다.
   미완료: (목록)
   → 모든 Story를 완료한 뒤 다시 실행하세요.
```

중단.

**Story 모드(`--story`):**

아래 파일 존재 여부를 확인한다:
- `${CLAUDE_PROJECT_DIR}/docs/plans/${NAME}/${STORY_ID}/complete.md` — 없으면 경고: `/sdlc:story complete 를 먼저 실행하세요.`
- `${CLAUDE_PROJECT_DIR}/docs/pr-drafts/${STORY_ID}.md` — 없으면 경고: `/sdlc:pr 를 먼저 실행하세요.`

경고만 출력하고 체크리스트 단계는 계속 진행 (사용자가 이미 완료했을 수 있음).

### 사용자 확인 체크리스트

자동 수집 후 아래를 **출력하고 사용자 응답을 기다린다** (`DRY_RUN=false` 일 때):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Phase 1: Pre-release 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 항목을 모두 확인했으면 "확인" 또는 "1234"를 입력하세요.
미완료 항목이 있으면 해당 번호와 사유를 알려주세요.

[ ] 1. PR이 base 브랜치(main/master)에 머지됐음
[ ] 2. 스테이징 환경에서 주요 플로우 직접 확인
[ ] 3. 스테이징에서 AC 시나리오 재검증 완료
[ ] 4. 롤백 방법을 알고 있음 (이전 버전 태그 또는 이전 이미지)
```

**사용자 응답 처리:**
- "확인", "1234", "모두", "all", "ok" → 4개 항목 전부 통과, Phase 1 결과를 `$PHASE1_RESULT` 변수에 "✅ 4/4 통과"로 기록, Phase 2 진행
- 특정 번호 누락 또는 "2번 아직" 등 → 해당 항목 미완료로 기록 후 중단:

```
❌ Phase 1 실패: 항목 (번호)이 확인되지 않았습니다.
   → 해당 항목을 완료한 후 /sdlc:release 를 다시 실행하세요.
```

**dry-run 모드:** 사용자 응답 없이 4개 항목 모두 `[ ]` 상태로 `$PHASE1_RESULT`에 기록 후 계속 진행.

## 3단계: Phase 2 — Go/No-go 게이트

> 목적: 두 페르소나가 각자의 관점에서 릴리스 준비 완료를 확인한다.

### dry-run 모드 처리

`$DRY_RUN=true` 이면 두 페르소나 모두 실제 확인 없이 GO를 출력한다:

```
👑 T'Challa (PM): GO ✅  [dry-run — 실제 확인 생략]
⚡ Thor (Platform): GO ✅  [dry-run — 실제 확인 생략]
```

`$GONOGO_RESULT="T'Challa: GO, Thor: GO, 최종: GO"` 로 기록하고 최종 판정 출력 후 계속 진행.

---

### T'Challa (PM) 리뷰 — 비즈니스 관점

`$DRY_RUN=false` 일 때, 다음 4개 항목을 확인하도록 사용자에게 묻는다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
👑 T'Challa (PM) Go/No-go 검토
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 항목을 모두 확인했으면 "확인" 또는 "1234"를 입력하세요.
미완료 항목이 있으면 해당 번호와 사유를 알려주세요.

[ ] 1. 이해관계자 사전 공지 완료
[ ] 2. 출시 타이밍이 마케팅·외부 일정과 충돌 없음
[ ] 3. KPI 측정 방법 준비
[ ] 4. 지원팀(CS)에 변경 내용 공유 완료
```

**사용자 응답 처리:**
- "확인", "1234", "모두", "all", "ok" → 4개 항목 전부 통과, T'Challa 판정: GO

  ```
  👑 T'Challa (PM): GO ✅
  사유: 이해관계자 공지 완료, KPI 대시보드 준비됨, CS 팀 사전 브리핑 완료.
  ```

- 특정 번호 누락 또는 미완료 항목 응답 → T'Challa 판정: NO-GO, 즉시 중단:

  ```bash
  GONOGO_RESULT="T'Challa: NO-GO, 최종: NO-GO"
  ```

  ```
  🛑 No-Go: T'Challa (PM) NO-GO — 비즈니스 준비 미완료
  → 해결 조건: (미완료 항목 번호와 사유)
  → 조건 해결 후 /sdlc:release 를 다시 실행하세요.
  ```

---

### Thor (Platform) 리뷰 — 인프라 관점

T'Challa가 GO인 경우에만 진행한다.

`$DRY_RUN=false` 일 때, 다음 4개 항목을 확인하도록 사용자에게 묻는다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Thor (Platform) Go/No-go 검토
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 항목을 모두 확인했으면 "확인" 또는 "1234"를 입력하세요.
미완료 항목이 있으면 해당 번호와 사유를 알려주세요.

[ ] 1. 모니터링 대시보드·알람 설정 완료
[ ] 2. 배포 대상 환경의 리소스 여유 충분
[ ] 3. DB 마이그레이션 있으면 온라인 마이그레이션 검증 완료 (해당 없으면 "N/A")
[ ] 4. 롤백 실행 방법이 runbook에 존재
```

**사용자 응답 처리:**
- "확인", "1234", "모두", "all", "ok" → 4개 항목 전부 통과, Thor 판정: GO

  ```
  ⚡ Thor (Platform): GO ✅
  사유: 알람 설정 확인, 마이그레이션 스테이징 검증 완료, runbook 업데이트됨.
  ```

- 특정 번호 누락 또는 미완료 항목 응답 → Thor 판정: NO-GO, 즉시 중단:

  ```bash
  GONOGO_RESULT="T'Challa: GO, Thor: NO-GO, 최종: NO-GO"
  ```

  ```
  🛑 No-Go: Thor (Platform) NO-GO — 인프라 준비 미완료
  → 해결 조건: (미완료 항목 번호와 사유)
  → 조건 해결 후 /sdlc:release 를 다시 실행하세요.
  ```

---

### 최종 판정

두 페르소나 모두 GO인 경우:

```bash
GONOGO_RESULT="T'Challa: GO, Thor: GO, 최종: GO"
```

```
🚀 최종 판정: GO — Phase 3로 진행합니다.
```

Phase 3로 계속 진행한다.

어느 한 페르소나라도 NO-GO이면 이미 위에서 중단되었으므로 이 지점에 도달하지 않는다.
