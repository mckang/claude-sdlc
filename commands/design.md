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

`$ARCH` 를 `Read` 해서 다음 조건 중 하나라도 만족하면 `UI_RECOMMENDED=1`:
- **기술 스택 섹션 행 안에** 다음 토큰 중 하나: `React`, `Next.js`, `Vue`, `Svelte`, `SwiftUI`, `Jetpack Compose`, `Flutter`, `frontend`
- **본문 전체에서** 다음 단어 중 하나: `화면`, `페이지`, `프론트엔드`

감지 결과는 메뉴의 (추천) 배지와 최종 판단 힌트에만 사용. **자동 실행 금지**.

> Note: 과거에 포함되었던 단독 `UI` 토큰은 거의 모든 아키텍처 문서(표·약어·API 설명 등)에 매칭돼 의미 없어지므로 제외. 필요하면 "화면"·"페이지"·"프론트엔드" 한국어 단어로 감지.

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

#### 참석자
- 주도: `backend` (`${CLAUDE_PLUGIN_ROOT}/agents/backend.md`)
- 참석: `architect`, `techlead`
- 조건부: `security` — PRD 또는 아키텍처에서 인증·권한·암호화 언급 감지 시 포함
- 진행: `facilitator`

각 페르소나 `.md` 를 `Read` 로 로드해 어조·관점을 반영.

#### 입력 로드
- `$PRD` 에서 FR 목록 추출
- `$ARCH` 에서 "API 계약 개요", "데이터 모델", "외부 의존성" 추출
- (편집 모드면) 기존 `$DESIGN_DIR/api.md` 도 컨텍스트에 포함

#### 회의 라운드

**Round 1 — 엔드포인트 식별 (backend 주도)**
- FR 하나하나를 HTTP 엔드포인트(또는 이벤트/gRPC 메서드)로 매핑
- 초기 엔드포인트 표 도출 (method/path/요약/인증 여부)
- 누락·중복 점검 (architect 교차 확인)

**Round 2 — 엔드포인트 상세 (backend + security)**
- 각 엔드포인트마다:
  - Request: path params / query / body 스키마
  - Response: 성공(200/201) 스키마 + 에러(4xx/5xx) 스키마
  - 에러 코드 표
  - 예시 요청·응답 JSON (최소 정상 1건 + 에러 1건)
  - Rate limit / idempotency / 멱등 키 필요 여부
- security 가 민감 엔드포인트(로그인·결제·개인정보) 에서 추가 헤더·감사 로그 요구 사항 제기

**Round 3 — 공통 규격 (techlead + backend)**
- 에러 응답 포맷(코드 체계, trace-id 포함 여부)
- 인증·권한 규칙(토큰 종류, 스코프)
- 버전 전략(URL vs header)
- Rate limit 정책(IP/사용자/토큰 기준)

#### 산출물 Write

`$DESIGN_DIR/api.md` 에 다음 템플릿으로 Write:

```markdown
# API 설계: {feature 제목}

- **식별자**: $NAME
- **작성일**: YYYY-MM-DD
- **참조 PRD**: ../../prd/prd-$NAME.md
- **참조 아키텍처**: ../../architecture/architecture-$NAME.md
- **참석자**: backend, architect, techlead, security?, facilitator
- **상태**: draft

## 엔드포인트 개요

| Method | Path | 요약 | 인증 | 비고 |
|--------|------|------|------|------|
| POST | /api/v1/... | ... | Bearer | ... |

## 엔드포인트 상세

### POST /api/v1/...
- **인증**: Bearer / Basic / None
- **Request**
  - path: (있으면)
  - query: (있으면)
  - body (JSON):
    \`\`\`json
    { "field": "..." }
    \`\`\`
- **Response**
  - `201 Created`:
    \`\`\`json
    { "id": "...", "createdAt": "..." }
    \`\`\`
  - `400/401/404/409/...` — 에러 코드 표 참조
- **에러 코드**
  | 코드 | 상황 | HTTP |
  | ... | ... | ... |
- **예시**
  - 정상 요청·응답 1쌍
  - 에러 요청·응답 1쌍
- **비고**: rate limit / idempotency / 멱등 키

> Round 1 에서 식별한 각 엔드포인트마다 위 블록(`### METHOD /path` 로 시작)을 반복 출력. "(반복)" 같은 축약 표기는 쓰지 말 것.

## 공통 규격

### 에러 응답 포맷
\`\`\`json
{ "code": "...", "message": "...", "traceId": "..." }
\`\`\`

### 인증·권한
- 토큰 종류: ...
- 스코프: ...

### 버전 전략
- URL (`/api/v1`) / Header / Query — 선택 근거

### Rate Limit
- 기준: IP / 사용자 / 토큰
- 기본 한도: ...

## 오픈 이슈
- [ ] ...

## 회의 로그
(전체 회의 발언 헤더·순서 보존해 append)
```

트랙 종료 시 `✓ API 저장: docs/design/$NAME/api.md → 다음 트랙: ...` 1줄 출력.

### 5-B. UI 트랙 (TRACK_UI=1 일 때)

#### 참석자
- 주도: `ux` (`${CLAUDE_PLUGIN_ROOT}/agents/ux.md`)
- 참석: `frontend`, `architect` (접근성·성능 교차 검토)
- 진행: `facilitator`

#### 입력 로드
- `$PRD` 에서 페르소나·유스케이스 추출
- `$ARCH` 에서 UI·프론트엔드 관련 언급 추출 (컴포넌트 섹션·기술 스택)
- (편집 모드면) 기존 `$DESIGN_DIR/ui.md` 도 컨텍스트에 포함

#### 회의 라운드

**Round 1 — 디자인 원칙 (ux 주도)**
- 이 feature 의 UI 가 지향하는 원칙 2-4 줄 (예: "밀도 높지만 실수 방지", "1차 액션만 강조")
- 페르소나 분석 결과와 정합성 확인
- 이후 라운드에서 토큰·컴포넌트가 원칙과 어긋나면 오픈 이슈에 기록.

**Round 2 — 토큰 정의 (ux + frontend)**
- 색: primary / secondary / semantic(success·warning·danger·info) / neutral 스케일
- 타이포: 스케일(h1~caption) / 각 스케일의 size·line-height·weight / font family
- 간격: 4px 또는 8px 기반 스케일 (spacing-1 ~ spacing-12 식)
- 라운드: 반경 스케일 (radius-sm/md/lg/full)
- 그림자: 깊이 스케일 (shadow-1 ~ shadow-4)
- 프로젝트 기존 토큰이 있으면(예: Tailwind config, 기존 DS) 재사용 권장 — 중복 창조 금지

**Round 3 — 컴포넌트 인벤토리 (frontend 주도)**
- 이 feature 에 필요한 컴포넌트 목록(Button/Input/Select/Modal/Card/Table/Toast/...)
- 각 컴포넌트: 용도 / variants(primary·secondary·ghost) / state(default·hover·active·disabled·loading) / 접근성 지침(aria, 키보드)
- 재사용 vs 신규 생성 판단 (architect 교차)

**Round 4 — 접근성 체크리스트 (architect 주도)**
- Round 3 은 컴포넌트별 가이드, Round 4 는 feature 전체 기준 — 중복 금지.
- WCAG 2.2 AA 기준 핵심 항목만:
  - 색 대비 ≥ 4.5:1 (body) / 3:1 (large)
  - 키보드 전용 내비게이션 가능
  - 포커스 표시 명확
  - aria-label / role 적절
  - 동작에 동반되는 시각 외 피드백

#### 산출물 Write

`$DESIGN_DIR/ui.md` 에 다음 템플릿으로 Write:

```markdown
# UI 디자인 시스템: {feature 제목}

- **식별자**: $NAME
- **작성일**: YYYY-MM-DD
- **참조 PRD**: ../../prd/prd-$NAME.md
- **참조 아키텍처**: ../../architecture/architecture-$NAME.md
- **참석자**: ux, frontend, architect, facilitator
- **상태**: draft

## 디자인 원칙
1. ...
2. ...

## 토큰

### 색
| 이름 | 값 | 용도 |
|------|-----|------|
| primary-500 | #3366ff | 기본 액션 |
| ... | ... | ... |

### 타이포그래피

- **Font family**: base / heading / mono — ...

| 스케일 | Size / Line-height / Weight | 용도 |
|-------|-----------------------------|------|
| h1 | 32 / 40 / 700 | 페이지 제목 |
| ... | ... | ... |

### 간격
| 이름 | 값 | 용도 |
|------|-----|------|
| spacing-2 | 8px | 컴포넌트 내부 |
| ... | ... | ... |

### 라운드 · 그림자
(표)

## 컴포넌트 인벤토리

| 컴포넌트 | 용도 | Variants | State | 접근성 |
|---------|------|----------|-------|--------|
| Button | ... | primary/secondary/ghost | default/hover/active/disabled/loading | aria-busy in loading |
| ... | ... | ... | ... | ... |

## 접근성 (WCAG 2.2 AA 체크리스트)
- [ ] 색 대비 ≥ 4.5:1 (본문) / ≥ 3:1 (large)
- [ ] 모든 인터랙션 요소 키보드 접근 가능
- [ ] 포커스 표시 시각적으로 명확
- [ ] form 에 label + aria-describedby (에러)
- [ ] 동적 컨텐츠에 aria-live 적절

## 오픈 이슈
- [ ] ...

## 회의 로그
(전체 회의 발언 헤더·순서 보존해 append)
```

트랙 종료 시 `✓ UI 저장: docs/design/$NAME/ui.md → 다음 트랙: ...` 1줄 출력.

### 5-C. Mockup 트랙 (TRACK_MOCKUP=1 일 때)

#### 참석자
- 주도: `ux`
- 참석: `frontend`, `pm` (유스케이스 매핑 확인)
- 진행: `facilitator`

#### 입력 로드
- `$PRD` 에서 페르소나·유스케이스 추출
- `$DESIGN_DIR/ui.md` 가 있으면 Read — 토큰·컴포넌트 참조
- (편집 모드면) 기존 `$DESIGN_DIR/mockup.md` 도 컨텍스트에 포함

#### 회의 라운드

**Round 1 — 화면 리스트 도출 (ux + pm)**
- 유스케이스 하나하나를 화면(들)로 매핑
- 화면 3-6 개로 수렴 (너무 많으면 Story 단위로 쪼갤 수 있음 — pm 판단)
- 각 화면에 ID 부여 (S1, S2, ...)

**Round 2 — 화면 흐름도 (ux 주도)**
- Mermaid `graph LR` 로 화면 간 전이
- 조건 분기(성공/에러)는 라벨로 표시
- 외부 진입점(딥링크·알림 등) 과 이탈점(완료·취소) 명시

**Round 3 — 화면별 와이어프레임 + 요소 + 상태 (ux + frontend)**
- Round 1 의 각 화면(S1, S2, ...)마다:
  - ASCII 와이어프레임 (박스·구분선 사용, 모바일/데스크톱 구분이 의미 있으면 둘 다)
  - 요소 표: 영역 / 컴포넌트(UI 트랙의 인벤토리 참조) / 상태 / 동작
  - 상태 시나리오: 로딩 / 에러 / 빈 상태 / 성공 피드백
- frontend 가 구현 가능성 교차 확인

#### 산출물 Write

`$DESIGN_DIR/mockup.md` 에 다음 템플릿으로 Write:

```markdown
# Mockup: {feature 제목}

- **식별자**: $NAME
- **작성일**: YYYY-MM-DD
- **참조 PRD**: ../../prd/prd-$NAME.md
- **참조 UI 디자인 시스템**: ui.md (있을 때)
- **참석자**: ux, frontend, pm, facilitator
- **상태**: draft

## 화면 리스트

| ID | 이름 | 유스케이스 | 비고 |
|----|------|-----------|------|
| S1 | ... | UC-1, UC-2 | 엔트리 |
| S2 | ... | ... | ... |

## 화면 흐름

\`\`\`mermaid
graph LR
  Entry[딥링크] --> S1[로그인]
  S1 -->|성공| S2[대시보드]
  S1 -->|실패| S1
  S2 --> S3[상세]
\`\`\`

## 화면 S1: {이름}

### 와이어프레임 (ASCII)
\`\`\`
+--------------------------------+
|  Header · 로그인                |
+--------------------------------+
|  [Email input]                 |
|  [Password input]              |
|                                |
|        [로그인 버튼]            |
|   계정이 없으신가요? [가입]      |
+--------------------------------+
\`\`\`

### 요소
| 영역 | 컴포넌트 | 상태 | 동작 |
|-----|---------|------|------|
| 헤더 | HeaderBar | default | 뒤로/메뉴 |
| 이메일 입력 | Input | default/error | onBlur 검증 |
| 로그인 버튼 | Button (primary) | default/loading/disabled | onClick → POST /auth/login |
| 가입 링크 | Link | default/hover | 가입 화면으로 이동 |

### 상태
- **로딩**: 버튼 loading, 입력 필드 disabled
- **에러**: Toast + 입력 필드 aria-invalid
- **빈 상태**: 해당 없음 (입력 기반 화면)

> Round 1 에서 정의한 각 화면(S1, S2, ...)마다 위 `## 화면 SN` 블록(와이어프레임 + 요소 표 + 상태)을 반복 출력. "(반복)" 같은 축약 표기는 쓰지 말 것.

## 오픈 이슈
- [ ] ...

## 회의 로그
(전체 회의 발언 헤더·순서 보존해 append)
```

트랙 종료 시 `✓ Mockup 저장: docs/design/$NAME/mockup.md → 인덱스 갱신` 1줄 출력.

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
- 이 파일에 `<!-- Task N에서 채워짐 -->` HTML 주석이 남아 있으면 안 됨 — 배포 전 `grep "Task .에서 채워짐" commands/design.md` 로 확인.
