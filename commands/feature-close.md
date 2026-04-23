---
argument-hint: [feature 이름, 생략 시 current]
description: feature 를 종결 상태로 전환 (soft gate 체크리스트 + frontmatter status=closed)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Feature 종결 (Feature Close)

사용자가 `/sdlc:feature-close [이름]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:feature-close                # current feature 종결
/sdlc:feature-close todo-app       # 이름 지정
```

## 목적

release / retrospective 까지 완료된 feature 를 **공식적으로 종결**한다.
체크리스트는 **soft gate** — 미충족 시 경고 후 사용자 확인하면 진행.

산출물 변경:
- `docs/features/feature-<name>.md` frontmatter 에 `status: closed`, `closed_at` 추가
- `CLAUDE.md` 의 `## Current Feature` / `## Feature Stack` 에서 해당 feature 제거

## 1단계: 인자 파싱 + 이름 resolve

```bash
NAME="${ARGUMENTS:-}"

if [ -z "$NAME" ]; then
  # current feature 사용
  NAME=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" list | awk '/^Current:/{sub(/^Current: */, ""); print; exit}')
  if [ -z "$NAME" ] || [ "$NAME" = "(없음)" ]; then
    echo "❌ current feature 가 없습니다. 이름을 명시해 주세요: /sdlc:feature-close <이름>"
    exit 1
  fi
fi

FEATURE_FILE="${CLAUDE_PROJECT_DIR}/docs/features/feature-${NAME}.md"

if [ ! -f "$FEATURE_FILE" ]; then
  echo "❌ Feature 파일이 없습니다: $FEATURE_FILE"
  exit 1
fi

PLAN_FILE="${CLAUDE_PROJECT_DIR}/docs/plans/plan-${NAME}.md"
TODAY=$(date +%Y-%m-%d)
```

## 2단계: Soft gate 체크리스트 수집

각 항목을 독립적으로 검사해 `pass` / `fail` 기록. 어느 하나 실패해도 **중단하지 않는다** — 결과만 모은다.

```bash
declare -a GATE_PASS=()
declare -a GATE_FAIL=()

# (1) 모든 Story complete
if [ -f "$PLAN_FILE" ]; then
  STORY_IDS=$(grep -oE '^#### (E[0-9]+-S[0-9]+):' "$PLAN_FILE" | awk '{print $2}' | tr -d ':' || true)
  TOTAL=$(wc -l <<<"$STORY_IDS" | tr -d ' ')
  [ -z "$STORY_IDS" ] && TOTAL=0
  DONE=0
  MISSING=""
  if [ "$TOTAL" -gt 0 ]; then
    while IFS= read -r SID; do
      [ -z "$SID" ] && continue
      if [ -f "${CLAUDE_PROJECT_DIR}/docs/plans/${NAME}/${SID}/complete.md" ]; then
        DONE=$((DONE+1))
      else
        MISSING="$MISSING $SID"
      fi
    done <<<"$STORY_IDS"
  fi
  if [ "$TOTAL" -gt 0 ] && [ "$DONE" -eq "$TOTAL" ]; then
    GATE_PASS+=("모든 Story complete ($DONE/$TOTAL)")
  else
    GATE_FAIL+=("Story 미완료: ${DONE}/${TOTAL}${MISSING:+ (미완료:${MISSING})}")
  fi
else
  GATE_FAIL+=("Plan 파일 없음: $PLAN_FILE")
fi

# (2) PR 머지 — pr-drafts 디렉터리에 각 Story 파일이 존재하는지만 간접 확인
if [ -n "$STORY_IDS" ]; then
  PR_MISSING=""
  while IFS= read -r SID; do
    [ -z "$SID" ] && continue
    if [ ! -f "${CLAUDE_PROJECT_DIR}/docs/pr-drafts/${SID}.md" ]; then
      PR_MISSING="$PR_MISSING $SID"
    fi
  done <<<"$STORY_IDS"
  if [ -z "$PR_MISSING" ]; then
    GATE_PASS+=("PR 본문 전부 생성됨")
  else
    GATE_FAIL+=("PR 본문 없음:${PR_MISSING}")
  fi
fi

# (3) Release 문서 존재
RELEASE_COUNT=$(find "${CLAUDE_PROJECT_DIR}/docs/releases" -maxdepth 1 -name "release-${NAME}-*.md" 2>/dev/null | wc -l | tr -d ' ')
if [ "$RELEASE_COUNT" -gt 0 ]; then
  GATE_PASS+=("Release 문서 ${RELEASE_COUNT}건")
else
  GATE_FAIL+=("Release 문서 없음 — /sdlc:release 미수행")
fi

# (4) Retrospective 문서 존재
RETRO_FILE="${CLAUDE_PROJECT_DIR}/docs/retrospectives/retro-${NAME}.md"
if [ -f "$RETRO_FILE" ]; then
  GATE_PASS+=("Retrospective 완료")
else
  GATE_FAIL+=("Retrospective 없음 — sdlc-retrospective skill 미수행")
fi

# (5) Action items 파일 존재
ACTIONS_FILE="${CLAUDE_PROJECT_DIR}/docs/retrospectives/retro-${NAME}.actions.md"
if [ -f "$ACTIONS_FILE" ]; then
  GATE_PASS+=("Action items 파일 존재")
else
  GATE_FAIL+=("Action items 파일 없음: $ACTIONS_FILE")
fi

# (정보) resolved_by: open 블록 개수
OPEN_COUNT=0
if [ -f "$PLAN_FILE" ]; then
  OPEN_COUNT=$(grep -cE '^[[:space:]]*resolved_by:[[:space:]]*open[[:space:]]*$' "$PLAN_FILE" 2>/dev/null)
  [ -z "$OPEN_COUNT" ] && OPEN_COUNT=0
fi
```

## 3단계: 체크리스트 결과 출력 + Soft gate 확인

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Feature 종결 체크리스트: <NAME>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

통과 (N):
  ✅ (pass 항목들)

미충족 (M):
  ❌ (fail 항목들)

ℹ️ 정보: plan 의 resolved_by: open 블록 <OPEN_COUNT>건
```

**M=0 이면** 바로 4단계로 진행. `$SKIP_CONFIRM=true`.

**M>0 이면** 다음 메시지를 출력하고 **사용자 응답을 기다린다**:

```
⚠️ 미충족 항목이 <M>건 있습니다.
그래도 종결하시겠습니까? (y 입력 시 종결, 그 외는 중단)
```

응답이 `y`/`yes`/`네`/`확인` 중 하나가 아니면 즉시 중단:

```
🛑 종결을 취소했습니다.
→ 미충족 항목을 해결한 뒤 다시 실행하세요.
```

## 4단계: Feature 문서 frontmatter 업데이트

`$FEATURE_FILE` 을 `Read` 로 읽어 YAML frontmatter 존재 여부를 판단한다:

- **파일의 첫 줄이 `---` 이면**: 기존 frontmatter 존재. `Edit` 로 두 가지 처리:
  - `status:` 라인이 있으면 그 값을 `closed` 로 교체
  - `status:` 라인이 없으면 기존 frontmatter 블록 내부에 `status: closed` 추가
  - `closed_at:` 라인이 있으면 오늘 날짜로 교체
  - `closed_at:` 라인이 없으면 `status:` 바로 다음에 `closed_at: <TODAY>` 삽입

- **파일의 첫 줄이 `---` 이 아니면**: frontmatter 없음. `Write` 또는 `Edit` 로 파일 맨 위에 새 블록 삽입:

  ```
  ---
  name: <NAME>
  status: closed
  created_at: <파일의 "- **작성일**: YYYY-MM-DD" 에서 추출, 없으면 오늘>
  closed_at: <TODAY>
  ---

  ```

  그 뒤에 기존 파일 본문 전체를 그대로 이어 붙인다.

주의:
- 본문의 `- **상태**: draft` 같은 기존 bullet 는 건드리지 않는다 (descriptive 정보). 진실원천은 frontmatter.
- 백업 파일은 만들지 않는다.

## 5단계: CLAUDE.md Current / Stack 에서 제거

```bash
# 현재 feature 와 동일하면 Current Feature 섹션 비움
CURRENT=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" list | awk '/^Current:/{sub(/^Current: */, ""); print; exit}')
if [ "$CURRENT" = "$NAME" ]; then
  # Current Feature 섹션만 제거 (Stack 은 건드리지 않음)
  perl -i -0777 -pe 's/\n*## Current Feature\n(?:-[^\n]*\n)*//g' "${CLAUDE_PROJECT_DIR}/CLAUDE.md"
  echo "✓ Current Feature 해제"
fi

# Stack 에 동일 이름 있으면 drop
if bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" read-stack | awk -F'|' -v n="$NAME" '$1==n {found=1} END {exit !found}'; then
  bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" drop "$NAME" || true
fi
```

## 6단계: 최종 보고 + 다음 단계 가이드

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Feature 종결 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

이름:      <NAME>
종결일:    <TODAY>
체크리스트: <PASS>/<PASS+FAIL> 통과
미해결 의견: resolved_by: open <OPEN_COUNT>건

산출물:
  docs/features/feature-<NAME>.md (status: closed 반영)

📌 다음 단계: /sdlc:next
  — 이전 feature 의 짐(미해결 의견·미이행 Try)을 리포트하고 다음 작업을 안내합니다.
```
