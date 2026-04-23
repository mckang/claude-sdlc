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
