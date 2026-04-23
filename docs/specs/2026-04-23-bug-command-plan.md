# /sdlc:bug Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `commands/bug.md` 를 작성해 비긴급 버그 신고·트리아지·Plan 연결 워크플로우를 구현한다.

**Architecture:** hotfix.md / release.md 와 동일한 마크다운 프로시저 패턴. Claude 가 파일을 읽고 자연어 지시를 따른다. 6개 단계로 구성: 제목 수집 → 심각도 분기 → 상세 수집 → 문서 생성 → Plan append → 완료 안내.

**Tech Stack:** Markdown (Claude 프로시저), Bash (resolve-plan-path.sh 호출), CLAUDE.md (current feature 참조)

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `commands/bug.md` | **신규 생성** — 전체 커맨드 프로시저 |
| `commands/init.md` | **수정** — mkdir 에 `bugs` 추가, 커맨드 목록에 `/sdlc:bug` 추가 |

---

### Task 1: frontmatter + 1단계 (title 수집)

**Files:**
- Create: `commands/bug.md`

- [ ] **Step 1: `commands/bug.md` 파일 생성 — frontmatter + 1단계**

```markdown
---
argument-hint: [title]
description: 비긴급 버그 신고·트리아지·Plan Story 연결
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Bug

사용자가 `/sdlc:bug [title]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:bug                              # 제목 대화 수집
/sdlc:bug login-button-not-responding  # 제목 지정
```

## 1단계: title 수집

```bash
POS_ARGS=()
for a in "$@"; do
  case "$a" in
    --*) echo "⚠️ 알 수 없는 플래그: $a" ;;
    *)   POS_ARGS+=("$a") ;;
  esac
done

TITLE="${POS_ARGS[*]:-}"
TODAY=$(date +%Y-%m-%d)
```

`TITLE` 이 비어 있으면 사용자에게 묻는다:

```
버그 제목을 한 줄로 입력해 주세요 (예: login-button-not-responding):
```

응답을 받아 `$TITLE` 에 저장하고 slug 를 생성한다:

```bash
SLUG=$(echo "$TITLE" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
```
```

- [ ] **Step 2: 파일이 올바르게 생성됐는지 확인**

```bash
head -20 commands/bug.md
```

Expected: frontmatter 3줄 + `# Bug` 헤더 + `## 1단계` 섹션 확인.

- [ ] **Step 3: 스펙 대조 — 1단계 요구사항 충족 확인**

스펙 `4. 단계별 상세 > 1단계` 항목:
- [x] 인자로 제공되면 그대로 사용
- [x] 없으면 대화로 수집
- [x] `$SLUG` 생성 (공백 → 하이픈, 소문자)

- [ ] **Step 4: commit**

```bash
git add commands/bug.md
git commit -m "feat(bug): scaffold commands/bug.md — frontmatter + 1단계 title 수집"
```

---

### Task 2: 2단계 — 심각도 선택 + Critical 분기

**Files:**
- Modify: `commands/bug.md`

- [ ] **Step 1: `## 2단계` 섹션 append**

파일 끝에 다음 내용을 추가한다:

```markdown

## 2단계: 심각도 선택

사용자에게 다음을 **출력하고 응답을 기다린다**:

```
심각도를 선택해 주세요:

  1) Critical — 즉각 대응 필요 (프로덕션 영향)
  2) High     — 오늘 내 처리 권장
  3) Medium   — 다음 스프린트 내 처리
  4) Low      — 여유 시간에 처리

답변 (1-4):
```

응답을 `$SEVERITY_INPUT` 으로 저장한다.

```bash
case "$SEVERITY_INPUT" in
  1|critical|Critical) SEVERITY="Critical" ;;
  2|high|High)         SEVERITY="High" ;;
  3|medium|Medium)     SEVERITY="Medium" ;;
  4|low|Low)           SEVERITY="Low" ;;
  *) echo "⚠️ 알 수 없는 심각도: $SEVERITY_INPUT — High 로 처리합니다."
     SEVERITY="High" ;;
esac
```

### Critical 분기

SEVERITY="Critical" 이면 다음을 출력하고 **즉시 종료**한다:

```
🚨 Critical 버그는 /sdlc:hotfix 로 즉각 대응하세요.

→ /sdlc:hotfix <title>                  # 기본 모드
→ /sdlc:hotfix <title> --emergency      # 긴급 모드

일반 버그 기록이 필요하면 심각도를 High 이하로 다시 실행하세요.
```
```

- [ ] **Step 2: 추가된 섹션 확인**

```bash
grep -n "2단계\|Critical\|SEVERITY" commands/bug.md
```

Expected: `## 2단계`, `SEVERITY="Critical"`, Critical 분기 메시지 라인 번호 출력.

- [ ] **Step 3: 스펙 대조 — 2단계 요구사항 확인**

스펙 `4. 단계별 상세 > 2단계` 항목:
- [x] 4단계 심각도 목록 출력
- [x] Critical → hotfix 권고 메시지 + 종료
- [x] 알 수 없는 입력 → High 처리 (안전 기본값)

- [ ] **Step 4: commit**

```bash
git add commands/bug.md
git commit -m "feat(bug): 2단계 — 심각도 선택 + Critical hotfix 분기"
```

---

### Task 3: 3단계 — 재현 단계 + 기대/실제 동작 수집

**Files:**
- Modify: `commands/bug.md`

- [ ] **Step 1: `## 3단계` 섹션 append**

```markdown

## 3단계: 재현 단계 + 기대/실제 동작 수집

다음 세 가지를 순서대로 **하나씩** 질의한다.

### 재현 단계

```
재현 단계를 입력해 주세요 (번호 목록 또는 자유 형식):
```

응답을 `$REPRO_STEPS` 에 저장한다.

### 기대 동작

```
기대 동작은 무엇인가요?
```

응답을 `$EXPECTED` 에 저장한다.

### 실제 동작

```
실제 동작은 무엇인가요?
```

응답을 `$ACTUAL` 에 저장한다.
```

- [ ] **Step 2: 추가된 섹션 확인**

```bash
grep -n "3단계\|REPRO_STEPS\|EXPECTED\|ACTUAL" commands/bug.md
```

Expected: `## 3단계`, 세 변수 선언 라인 번호 출력.

- [ ] **Step 3: 스펙 대조 — 3단계 요구사항 확인**

스펙 `4. 단계별 상세 > 3단계` 항목:
- [x] 순서대로 하나씩 질의
- [x] 재현 단계 → `$REPRO_STEPS`
- [x] 기대 동작 → `$EXPECTED`
- [x] 실제 동작 → `$ACTUAL`

- [ ] **Step 4: commit**

```bash
git add commands/bug.md
git commit -m "feat(bug): 3단계 — 재현 단계·기대/실제 동작 수집"
```

---

### Task 4: 4단계 — 버그 문서 생성

**Files:**
- Modify: `commands/bug.md`

- [ ] **Step 1: `## 4단계` 섹션 append**

```markdown

## 4단계: 버그 문서 생성

```bash
BUG_DOC="${CLAUDE_PROJECT_DIR}/docs/bugs/bug-${SLUG}-${TODAY}.md"
mkdir -p "${CLAUDE_PROJECT_DIR}/docs/bugs"
```

다음 내용으로 `$BUG_DOC` 를 생성한다:

````markdown
# Bug: <TITLE> — <TODAY>

- 심각도: <SEVERITY>
- 상태: Open

## 재현 단계
<REPRO_STEPS>

## 기대 동작
<EXPECTED>

## 실제 동작
<ACTUAL>
````

생성 후 확인 메시지:

```
✓ 버그 문서 생성: docs/bugs/bug-<SLUG>-<TODAY>.md
```
```

- [ ] **Step 2: 추가된 섹션 확인**

```bash
grep -n "4단계\|BUG_DOC\|docs/bugs" commands/bug.md
```

Expected: `## 4단계`, `BUG_DOC=`, `mkdir -p` 라인 번호 출력.

- [ ] **Step 3: 스펙 대조 — 4단계 요구사항 확인**

스펙 `4. 단계별 상세 > 4단계` 항목:
- [x] 경로: `docs/bugs/bug-${SLUG}-${TODAY}.md`
- [x] `docs/bugs/` 없으면 생성
- [x] 문서 구조: 심각도·상태·재현·기대·실제 섹션

- [ ] **Step 4: commit**

```bash
git add commands/bug.md
git commit -m "feat(bug): 4단계 — 버그 문서 생성"
```

---

### Task 5: 5단계 — Plan Story append

**Files:**
- Modify: `commands/bug.md`

- [ ] **Step 1: `## 5단계` 섹션 append**

```markdown

## 5단계: Plan 파일에 Story append

`scripts/resolve-plan-path.sh` 로 현재 feature 의 Plan 경로를 결정한다:

```bash
if PLAN_OUT=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-plan-path.sh" 2>/dev/null); then
  PLAN_PATH=$(sed -n 2p <<<"$PLAN_OUT")
else
  PLAN_PATH=""
fi
```

### Plan 파일이 없는 경우

`PLAN_PATH` 가 비어 있거나 파일이 존재하지 않으면:

- current feature 미설정인 경우:
  ```
  ⚠️ CLAUDE.md 에 current feature 가 없습니다. 버그 문서만 생성합니다.
  ```
- Plan 파일 미존재인 경우:
  ```
  ⚠️ Plan 파일을 찾을 수 없습니다 (<PLAN_PATH>). 버그 문서만 생성합니다.
  ```

두 경우 모두 6단계로 진행한다 (`PLAN_APPENDED=false`).

### Plan 파일이 있는 경우

`$PLAN_PATH` 파일 맨 끝에 다음을 append 한다:

````markdown

### Bug Story: <TITLE>

- [ ] 재현 확인
- [ ] 원인 분석
- [ ] 수정 구현
- [ ] 테스트 + PR
- 참조: docs/bugs/bug-<SLUG>-<TODAY>.md
````

append 후:
```bash
PLAN_APPENDED=true
```

확인 메시지:
```
✓ Plan Story 추가: <PLAN_PATH>
```
```

- [ ] **Step 2: 추가된 섹션 확인**

```bash
grep -n "5단계\|resolve-plan-path\|PLAN_PATH\|PLAN_APPENDED\|Bug Story" commands/bug.md
```

Expected: `## 5단계`, `resolve-plan-path.sh`, `PLAN_APPENDED`, `Bug Story` 라인 번호 출력.

- [ ] **Step 3: 스펙 대조 — 5단계 요구사항 확인**

스펙 `4. 단계별 상세 > 5단계` 항목:
- [x] `resolve-plan-path.sh` 사용
- [x] Plan 없을 때 두 케이스 경고 처리 (current feature 없음 / 파일 없음)
- [x] Plan 있을 때 Bug Story 항목 append
- [x] Story 구조: 4개 체크박스 + 참조 링크

- [ ] **Step 4: commit**

```bash
git add commands/bug.md
git commit -m "feat(bug): 5단계 — Plan 파일에 Bug Story append"
```

---

### Task 6: 6단계 — 완료 요약 + init.md 업데이트

**Files:**
- Modify: `commands/bug.md`
- Modify: `commands/init.md`

- [ ] **Step 1: `## 6단계` 섹션 append to `commands/bug.md`**

```markdown

## 6단계: 완료 요약

다음 형식으로 요약을 출력한다:

```
✓ 버그 기록 완료

- 문서: docs/bugs/bug-<SLUG>-<TODAY>.md
- 심각도: <SEVERITY>
- Plan Story 추가: <PLAN_PATH (PLAN_APPENDED=true 일 때) 또는 "없음">

다음 단계:
- /sdlc:plan 으로 Story 우선순위 조정
- /sdlc:story start 로 수정 시작
```
```

- [ ] **Step 2: `commands/init.md` — mkdir 에 `bugs` 추가**

[commands/init.md](commands/init.md) 의 1단계 mkdir 줄을 찾아 `bugs` 를 추가한다.

변경 전:
```
mkdir -p "${CLAUDE_PROJECT_DIR}/docs"/{features,prd,architecture,plans,plans/archive,plans/scope-changes,meetings,retrospectives,standups,pr-drafts,onboarding,guides,standards,releases}
```

변경 후:
```
mkdir -p "${CLAUDE_PROJECT_DIR}/docs"/{features,prd,architecture,plans,plans/archive,plans/scope-changes,meetings,retrospectives,standups,pr-drafts,onboarding,guides,standards,releases,bugs}
```

- [ ] **Step 3: `commands/init.md` — 커맨드 목록에 `/sdlc:bug` 추가**

6단계 완료 안내의 `## 사용 가능한 커맨드` 목록에서 `/sdlc:hotfix` 줄 바로 뒤에 추가:

```
- `/sdlc:bug` — 비긴급 버그 신고·트리아지·Plan Story 연결
```

- [ ] **Step 4: 변경 사항 확인**

```bash
grep -n "bugs\|sdlc:bug" commands/init.md
```

Expected: mkdir 줄에 `bugs`, 커맨드 목록에 `/sdlc:bug` 라인 번호 출력.

- [ ] **Step 5: 전체 `commands/bug.md` 최종 확인**

```bash
wc -l commands/bug.md
grep -c "^## [0-9]단계" commands/bug.md
```

Expected: 6단계 섹션 6개 (`## 1단계` ~ `## 6단계`) 확인.

- [ ] **Step 6: 스펙 대조 — 6단계 + init 요구사항 확인**

스펙 항목:
- [x] 완료 요약: 문서 경로, 심각도, Plan Story 경로 또는 "없음"
- [x] 다음 단계 안내
- [x] `docs/bugs/` 디렉토리 init.md 에 추가
- [x] `/sdlc:bug` 커맨드 목록에 추가

- [ ] **Step 7: commit**

```bash
git add commands/bug.md commands/init.md
git commit -m "feat(bug): 6단계 완료 요약 + init.md docs/bugs & 커맨드 목록 업데이트"
```
