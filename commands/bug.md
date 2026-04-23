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

### title 수집

`TITLE` 이 비어 있으면 사용자에게 묻는다:

```
버그 제목을 한 줄로 입력해 주세요 (예: login-button-not-responding):
```

응답을 받아 `$TITLE` 에 저장한다. title 에 공백이 있으면 하이픈으로 변환해 `$SLUG` 를 생성한다 (인자로 제공한 경우도 동일하게 적용):

```bash
SLUG=$(echo "$TITLE" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
```

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

```bash
if [ "$SEVERITY" = "Critical" ]; then
```

```
🚨 Critical 버그는 /sdlc:hotfix 로 즉각 대응하세요.

→ /sdlc:hotfix <title>                  # 기본 모드
→ /sdlc:hotfix <title> --emergency      # 긴급 모드

일반 버그 기록이 필요하면 심각도를 High 이하로 다시 실행하세요.
```

```bash
  exit 1
fi
```

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

생성 후 확인 메시지를 출력한다:

```
✓ 버그 문서 생성: docs/bugs/bug-<SLUG>-<TODAY>.md
```

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

`PLAN_PATH` 가 비어 있거나 파일이 존재하지 않으면 상황에 따라 안내한다.

current feature 미설정인 경우 (스크립트가 exit 1 로 종료):
```
⚠️ CLAUDE.md 에 current feature 가 없습니다. 버그 문서만 생성합니다.
```

Plan 파일이 존재하지 않는 경우 (`[ ! -f "$PLAN_PATH" ]`):
```
⚠️ Plan 파일을 찾을 수 없습니다 (<PLAN_PATH>). 버그 문서만 생성합니다.
```

두 경우 모두 `PLAN_APPENDED=false` 로 설정하고 6단계로 진행한다.

### Plan 파일이 있는 경우

`$PLAN_PATH` 파일 맨 끝에 다음을 append 한다:

```markdown

### Bug Story: <TITLE>

- [ ] 재현 확인
- [ ] 원인 분석
- [ ] 수정 구현
- [ ] 테스트 + PR
- 참조: docs/bugs/bug-<SLUG>-<TODAY>.md
```

append 후:
```bash
PLAN_APPENDED=true
```

확인 메시지:
```
✓ Plan Story 추가: <PLAN_PATH>
```
