---
argument-hint: [feature이름] [--api] [--ui] [--mockup] [--all]
description: API · UI 디자인 시스템 · Mockup 중 선택한 트랙을 회의 형식으로 설계 — architecture 와 plan 사이의 선택 단계
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Design 설계 명령

사용자가 `/sdlc:design [feature이름] [--api] [--ui] [--mockup] [--all]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:design                                  # current feature + 대화형 메뉴
/sdlc:design checkout-v2 --api                # API 트랙만
/sdlc:design --api --ui                       # current feature, API+UI
/sdlc:design checkout-v2 --all                # 세 트랙 전부
```

## 1단계: 인자 파싱 (feature 이름 + 트랙 플래그)

```bash
NAME=""
TRACK_API=0
TRACK_UI=0
TRACK_MOCKUP=0

for arg in $ARGUMENTS; do
  case "$arg" in
    --api)    TRACK_API=1 ;;
    --ui)     TRACK_UI=1 ;;
    --mockup) TRACK_MOCKUP=1 ;;
    --all)    TRACK_API=1; TRACK_UI=1; TRACK_MOCKUP=1 ;;
    --*)      echo "❌ 알 수 없는 플래그: $arg"; exit 1 ;;
    *)        if [ -z "$NAME" ]; then NAME="$arg"; else echo "❌ feature 이름은 하나만 허용: $arg"; exit 1; fi ;;
  esac
done

# Current Feature resolve
if [ -z "$NAME" ]; then
  CLAUDE_MD="${CLAUDE_PROJECT_DIR}/CLAUDE.md"
  if [ -f "$CLAUDE_MD" ]; then
    NAME=$(awk '/^## Current Feature$/{flag=1; next} flag && /^- \*\*이름\*\*:/{sub(/^- \*\*이름\*\*: */, ""); print; exit}' "$CLAUDE_MD")
  fi
  if [ -z "$NAME" ]; then
    cat <<'EOF'
❌ feature 이름이 지정되지 않았고, CLAUDE.md 에 Current Feature 도 없습니다.

다음 중 하나로 해결하세요:
  /sdlc:feature <이름>            # feature 부터 시작 (current 자동 등록)
  /sdlc:design <이름> [--api ...] # 이름을 직접 지정
EOF
    exit 1
  fi
  echo "ℹ️  Current Feature 사용: $NAME"
fi

NO_FLAGS=0
if [ "$TRACK_API$TRACK_UI$TRACK_MOCKUP" = "000" ]; then
  NO_FLAGS=1
fi
```

## 2단계: 사전조건 확인 — PRD + Architecture 존재

```bash
PRD="${CLAUDE_PROJECT_DIR}/docs/prd/prd-$NAME.md"
ARCH="${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-$NAME.md"

test -f "$PRD"  || { echo "❌ PRD 없음: $PRD (선행: /sdlc:prd $NAME)"; exit 1; }
test -f "$ARCH" || { echo "❌ Architecture 없음: $ARCH (선행: /sdlc:architecture $NAME)"; exit 1; }
```

## 3단계: 트랙 결정 (플래그 없음 → 대화형 메뉴)

`NO_FLAGS=1` 이면 대화형 메뉴를 출력한다. 아키텍처 문서에서 frontend 관련 키워드를 감지해 "(추천)" 배지를 붙인다.

### 3-a. frontend 감지

`$ARCH` 를 `Read` 해서 다음 키워드 중 하나라도 있으면 `UI_RECOMMENDED=1`:
- 기술 스택 섹션 내: `React`, `Next.js`, `Vue`, `Svelte`, `SwiftUI`, `Jetpack Compose`, `Flutter`, `frontend`, `UI`
- 컴포넌트 섹션 또는 본문: `화면`, `페이지`, `UI`, `프론트엔드`

감지 결과는 메뉴의 (추천) 배지와 최종 판단 힌트에만 사용. **자동 실행 금지**.

### 3-b. 메뉴 출력

아래 메뉴를 출력하고 사용자 입력(1-6)을 대기. `UI_RECOMMENDED=1` 이면 항목 4·5 옆에 `(추천)`, `UI_RECOMMENDED=0` 이면 항목 1 옆에 `(추천)`.

```
이 feature 에 어떤 design 트랙을 실행할까요? — $NAME

  1) API 만
  2) UI 디자인 시스템 만
  3) Mockup 만
  4) API + UI
  5) 전체 (API + UI + Mockup)
  6) 취소

선택 (1-6):
```

사용자 응답을 받아 `TRACK_API/TRACK_UI/TRACK_MOCKUP` 을 설정. `6` 이면 종료.

## 4단계: 출력 디렉터리 준비 및 기존 파일 처리

```bash
DESIGN_DIR="${CLAUDE_PROJECT_DIR}/docs/design/$NAME"
mkdir -p "$DESIGN_DIR"
```

각 선택된 트랙마다 실행 직전에 다음 점검:

- 대상 파일(`api.md`/`ui.md`/`mockup.md`) 가 이미 있으면:
  ```
  docs/design/$NAME/<파일명> 이 이미 존재합니다.
    1) 덮어쓰기 (기존은 archive/<YYYYMMDD-HHMM>/<파일명> 으로 백업)
    2) 편집 모드 (기존 내용을 기반으로 보강)
    3) 취소 (이 트랙만 건너뛰기)
  ```
  사용자 응답 대기. 1 이면:
  ```bash
  STAMP=$(date +%Y%m%d-%H%M)
  ARCHIVE="$DESIGN_DIR/archive/$STAMP"
  mkdir -p "$ARCHIVE"
  mv "$DESIGN_DIR/<파일명>" "$ARCHIVE/<파일명>"
  ```
  2 면 기존 파일을 `Read` 해서 회의 컨텍스트에 포함. 3 이면 해당 트랙만 skip.

- 새 트랙(파일 없음) 이면 바로 진행.

## 5단계: 선택된 트랙 순차 실행

트랙은 **API → UI → Mockup** 순으로 실행 (UI 토큰이 정해진 뒤 Mockup이 참조 가능하도록).
각 트랙은 기존 `/sdlc:architecture` 패턴의 축소판 — 한 응답 내 다자 회의 + Markdown 산출물 Write.
`facilitator` 는 모든 트랙에 자동 참석.

발화 형식:
```
**[이모지] [이름] ([역할]):**
(2-5 문단, 근거·트레이드오프 포함)
```

공통 규칙:
- 사용자 결정 지점에선 즉시 멈추고 질의
- 숫자·확신 없으면 `TBD` + 오픈 이슈
- 트랙 종료 시 1줄 고지: `✓ <트랙> 저장: docs/design/$NAME/<파일명> → 다음 트랙: <XXX>` (마지막 트랙이면 "→ 인덱스 갱신")

### 5-A. API 트랙 (TRACK_API=1 일 때)

<!-- Task 2에서 채워짐 -->

### 5-B. UI 트랙 (TRACK_UI=1 일 때)

<!-- Task 3에서 채워짐 -->

### 5-C. Mockup 트랙 (TRACK_MOCKUP=1 일 때)

<!-- Task 4에서 채워짐 -->

## 6단계: README.md 인덱스 생성/갱신

모든 선택된 트랙 실행 후 `$DESIGN_DIR/README.md` 를 **항상 덮어쓰기** (확인 없음). 현재 디렉터리에 있는 파일들(`api.md`/`ui.md`/`mockup.md`)을 glob으로 탐지해 링크 생성.

산출물 템플릿:

```markdown
# Design: {feature 제목}

- **식별자**: $NAME
- **참조 PRD**: ../../prd/prd-$NAME.md
- **참조 아키텍처**: ../../architecture/architecture-$NAME.md
- **최종 갱신**: $(date +%Y-%m-%d)
- **실행된 트랙**: {api, ui, mockup 중 존재하는 것만}

## 산출물
- [API 설계](api.md) — 최종 갱신 YYYY-MM-DD   (파일이 있을 때만)
- [UI 디자인 시스템](ui.md) — 최종 갱신 YYYY-MM-DD   (파일이 있을 때만)
- [Mockup](mockup.md) — 최종 갱신 YYYY-MM-DD   (파일이 있을 때만)

## 다음 단계
- [ ] 실행 계획 생성: `/sdlc:plan` — design 디렉터리가 자동 참조됩니다.
```

"feature 제목" 은 `$PRD` 첫 줄(`# PRD: {제목}`)에서 추출. 추출 실패 시 `$NAME` 그대로 사용.

각 산출물 파일의 "최종 갱신" 일자는 해당 파일의 mtime(또는 본 실행 날짜)을 사용.

## 7단계: 최종 보고

```
✅ Design 설계 완료

Feature: {제목}
식별자: $NAME
입력: docs/prd/prd-$NAME.md, docs/architecture/architecture-$NAME.md
산출물 디렉터리: docs/design/$NAME/
- api.md (실행 시)
- ui.md (실행 시)
- mockup.md (실행 시)
- README.md (인덱스)

요약:
- 실행 트랙: {api, ui, mockup}
- 건너뛴 트랙: {있으면 사유 — 사용자 취소 / 선택 안 함}
- 오픈 이슈: N

다음 단계:
  /sdlc:plan              — Epic→Story→Task 분해 (design 디렉터리 자동 참조)
```

## 주의사항

- 신규 페르소나를 만들지 말 것 — 기존 21 개 안에서만 선택.
- 트랙 순서는 **API → UI → Mockup** 고정 (Mockup 이 UI 토큰을 참조할 수 있도록).
- 기존 파일을 **자동 덮어쓰지 말 것** — 항상 사용자 확인. 단, `README.md` 인덱스는 예외(항상 갱신).
- archive 디렉터리는 **파일 단위**로 만들 것(트랙 하나만 덮어써도 그 파일만 백업).
- 플래그 조합 파싱 실패 시 즉시 종료(`exit 1`) — 반쯤 실행하지 말 것.
- 회의 전체를 하나의 Claude 응답에서 끝내되, 사용자 결정 지점에선 멈추고 대기.
- 트랙별 산출물의 최상단 메타 필드는 `- **식별자**: $NAME` 를 반드시 포함 (후속 커맨드 resolve 용).
