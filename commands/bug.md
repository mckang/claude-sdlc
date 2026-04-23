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

```
🚨 Critical 버그는 /sdlc:hotfix 로 즉각 대응하세요.

→ /sdlc:hotfix <title>                  # 기본 모드
→ /sdlc:hotfix <title> --emergency      # 긴급 모드

일반 버그 기록이 필요하면 심각도를 High 이하로 다시 실행하세요.
```
