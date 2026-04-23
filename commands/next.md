---
description: 가장 최근 종결된 feature 의 짐(미해결 반대의견·미이행 Try·미완료 Story)을 리포트하고 다음 작업을 안내한다
allowed-tools: Read, Glob, Grep, Bash
---

# 다음 Feature 안내 (Next)

사용자가 `/sdlc:next` 로 호출했다. 인자는 받지 않는다.

## 목적

`/sdlc:feature-close` 로 종결된 feature 의 "짐"을 사용자에게 리포트한다.
**파일은 생성/수정하지 않는다** — 순수 리포트 + 안내.

리포트 대상:
1. 미해결 `resolved_by: open` 반대 의견 (plan 파일 YAML 블록)
2. 미이행 retro Try 항목 (actions.md 에서 상태가 `✅ done` 이 아닌 행)
3. 미완료 Story (plan 의 Story 중 complete.md 없는 것)

그 다음 Feature Stack 상태에 따라 다음 액션을 안내.

## 1단계: 가장 최근 종결된 feature 찾기

`${CLAUDE_PROJECT_DIR}/docs/features/` 하위 파일들을 읽어 frontmatter 의 `status: closed` + 최대 `closed_at` 인 feature 를 찾는다.

```bash
FEATURES_DIR="${CLAUDE_PROJECT_DIR}/docs/features"
LATEST=""
LATEST_DATE=""

if [ -d "$FEATURES_DIR" ]; then
  for f in "$FEATURES_DIR"/feature-*.md; do
    [ -f "$f" ] || continue
    # frontmatter 가 있는지, status: closed 인지, closed_at 값 추출
    STATUS=$(awk '/^---$/{n++; next} n==1 && /^status:/{sub(/^status:[[:space:]]*/, ""); print; exit}' "$f")
    [ "$STATUS" != "closed" ] && continue
    CLOSED=$(awk '/^---$/{n++; next} n==1 && /^closed_at:/{sub(/^closed_at:[[:space:]]*/, ""); print; exit}' "$f")
    [ -z "$CLOSED" ] && continue
    if [ -z "$LATEST_DATE" ] || [[ "$CLOSED" > "$LATEST_DATE" ]]; then
      LATEST_DATE="$CLOSED"
      # 파일명에서 이름 추출: feature-<name>.md
      base=$(basename "$f" .md)
      LATEST="${base#feature-}"
    fi
  done
fi

if [ -z "$LATEST" ]; then
  echo "ℹ️ 종결된 feature 가 없습니다."
  echo ""
  echo "📌 다음 액션:"
  echo "  /sdlc:feature <이름>     — 새 feature 시작"
  exit 0
fi
```

## 2단계: 이전 feature 의 짐 스캔

```bash
PREV="$LATEST"
PLAN_FILE="${CLAUDE_PROJECT_DIR}/docs/plans/plan-${PREV}.md"
ACTIONS_FILE="${CLAUDE_PROJECT_DIR}/docs/retrospectives/retro-${PREV}.actions.md"
```

### (A) 미해결 반대 의견 — plan 파일의 `resolved_by: open` YAML 블록

`$PLAN_FILE` 에서 `resolved_by: open` 을 포함한 각 YAML 블록을 추출. 블록은 `- speaker:` 로 시작하고 다음 `- speaker:` / 빈 줄 / 섹션 헤더 전까지가 범위다.

`Read` 로 plan 파일을 읽고, Claude 가 다음과 같은 블록을 전부 찾아 아래 형식으로 정리:

```yaml
- speaker: Tony · Architect
  opinion: "테스트 없이 예제 내보내는 게 표준에 어긋난다."
  reason_not_adopted: ...
  resolved_by: open
  review_trigger: 회고 시
```

개수 카운트:
```bash
OPEN_COUNT=0
if [ -f "$PLAN_FILE" ]; then
  OPEN_COUNT=$(grep -cE '^[[:space:]]*resolved_by:[[:space:]]*open[[:space:]]*$' "$PLAN_FILE" 2>/dev/null)
  [ -z "$OPEN_COUNT" ] && OPEN_COUNT=0
fi
```

### (B) 미이행 retro Try — actions.md 에서 상태 != done

`$ACTIONS_FILE` 의 "진행 상태" 표를 Read. 각 행에서 `| ... | 상태 |` 컬럼을 보고 `✅ done` 이 아닌 행을 "미이행" 으로 분류.

```bash
OPEN_ACTIONS=0
if [ -f "$ACTIONS_FILE" ]; then
  # 데이터 행(`| A1 | ...`) 중 "✅ done" 이 없는 행을 open 으로 카운트
  OPEN_ACTIONS=$(awk '
    /^\| *[A-Z][0-9]/ {
      if ($0 !~ /✅ done/) print
    }
  ' "$ACTIONS_FILE" | wc -l | tr -d ' ')
fi
```

미이행 행이 있으면 각 행의 `ID`, `내용`, `담당`, `우선순위` 를 추출해 리포트.

### (C) 미완료 Story — plan 의 Story 중 complete.md 없는 것

```bash
INCOMPLETE_STORIES=""
if [ -f "$PLAN_FILE" ]; then
  STORY_IDS=$(grep -oE '^#### (E[0-9]+-S[0-9]+):' "$PLAN_FILE" | awk '{print $2}' | tr -d ':' || true)
  while IFS= read -r SID; do
    [ -z "$SID" ] && continue
    if [ ! -f "${CLAUDE_PROJECT_DIR}/docs/plans/${PREV}/${SID}/complete.md" ]; then
      INCOMPLETE_STORIES="$INCOMPLETE_STORIES $SID"
    fi
  done <<<"$STORY_IDS"
fi
```

## 3단계: Feature Stack 상태 확인

```bash
STACK_OUTPUT=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" read-stack)
STACK_TOP=""
if [ -n "$STACK_OUTPUT" ]; then
  STACK_TOP=$(head -n1 <<<"$STACK_OUTPUT" | awk -F'|' '{print $1}')
fi

CURRENT=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" list | awk '/^Current:/{sub(/^Current: */, ""); print; exit}')
```

## 4단계: 리포트 출력

Claude 가 아래 형식으로 정리해 출력한다. 값이 0/빈 경우 해당 섹션은 "없음" 으로 표기.

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 이전 Feature 짐 리포트: <PREV>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
종결일: <LATEST_DATE>

## 1. 미해결 반대 의견 (resolved_by: open) — <OPEN_COUNT>건

<YAML 블록 목록 또는 "없음">

## 2. 미이행 retro Try — <OPEN_ACTIONS>건

<표 형태로 ID · 내용 · 담당 · 우선순위, 또는 "없음">

## 3. 미완료 Story — <INCOMPLETE_STORIES 개수>건

<Story ID 목록 또는 "없음">

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📌 다음 액션
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### 4-1. 다음 액션 분기

- **Current 가 설정되어 있으면** (`$CURRENT` 가 "(없음)" 이나 빈 값이 아니면):
  ```
  현재 진행 중: <CURRENT>
    — 이어서 작업: /sdlc:status 또는 /sdlc:story start <ID>
  ```

- **Current 는 없고 Stack top 이 있으면**:
  ```
  스택 대기 중: <STACK_TOP>
    — 재개: /sdlc:feature --pop
  ```

- **둘 다 없으면**:
  ```
  새 feature 시작: /sdlc:feature <이름>
  ```

### 4-2. 짐 반영 안내

짐이 1건이라도 있으면 마지막에 한 줄 추가:

```
💡 위 미해결/미이행 항목들은 새 feature 의 /sdlc:feature 또는 /sdlc:prd 단계에서 반영 여부를 검토하세요.
```

## 주의사항

- **파일 생성·수정 금지**. 이 커맨드는 순수 리포트.
- YAML 블록 파싱 실패해도 경고만 출력하고 계속 진행 (format drift 허용).
- actions.md 가 없거나 표 형식이 아니면 해당 섹션 "없음" 처리.
