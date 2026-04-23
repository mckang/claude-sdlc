---
argument-hint: [feature 이름] | [PRD경로] [아키텍처경로] [산출물경로]
description: PRD와 아키텍처를 읽고 Epic→Story→Task 분해 계획을 생성 — feature 이름으로 간편 호출 가능
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 실행 계획 생성 명령

이 커맨드는 **세 가지 호출 형식**을 지원한다. 대부분의 경우 아무 인자 없이 호출해 current feature 를 이어받으면 된다.

예시:
```
/sdlc:plan                                  # current feature 사용 (권장)
/sdlc:plan checkout-v2                      # 이름 지정 → 경로 자동 resolve
/sdlc:plan docs/prd/prd-x.md docs/architecture/architecture-x.md docs/plans/plan-x.md   # 명시 경로 (레거시)
```

## 1단계: 인자 파싱 (3가지 호출 형식)

전체 인자: `$ARGUMENTS`

```bash
set -- $ARGUMENTS

if [ "$#" -eq 3 ]; then
  # 형식 3: 명시 경로 (레거시)
  PRD="$1"; ARCH="$2"; OUT="$3"
  NAME=$(basename "$PRD" .md | sed 's/^prd-//')
elif [ "$#" -le 1 ]; then
  # 형식 1 또는 2: feature 이름 (또는 current) → NAME·PLAN resolve
  OUT_ARG=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-plan-path.sh" "${1:-}") || exit 1
  NAME=$(sed -n 1p <<<"$OUT_ARG")
  OUT=$(sed -n 2p <<<"$OUT_ARG")
  PRD="${CLAUDE_PROJECT_DIR}/docs/prd/prd-$NAME.md"
  ARCH="${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-$NAME.md"
else
  echo "❌ 인자 수가 맞지 않습니다 (0, 1, 또는 3개 허용)."
  exit 1
fi
```

### 입력 파일 존재 확인
```bash
test -f "$PRD" || { echo "❌ PRD 없음: $PRD (선행: /sdlc:prd $NAME)"; exit 1; }
test -f "$ARCH" || { echo "❌ Architecture 없음: $ARCH (선행: /sdlc:architecture $NAME)"; exit 1; }
mkdir -p "$(dirname "$OUT")"
```

이후 본 문서에서 PRD·아키텍처·산출물 경로를 언급할 때는 위에서 확정한 `$PRD`, `$ARCH`, `$OUT` 을 사용한다.

## 2단계: 입력 문서 분석

PRD와 아키텍처 문서를 각각 `Read` 해서 다음 정보를 추출:

### PRD에서 추출
- **목표·성공 지표** (측정 가능한 KPI)
- **사용자 스토리 / 유스케이스**
- **기능 요구사항 (FR)** 목록
- **비기능 요구사항 (NFR)**: 성능·보안·접근성·호환성
- **수용 기준 (AC)** 초안
- **범위 외 (Out of Scope)**
- **가정 및 미결 사항**

### 아키텍처에서 추출
- **컴포넌트·서비스 목록**
- **데이터 모델 / 주요 엔티티**
- **API 엔드포인트 (요약)**
- **기술 스택** (언어·프레임워크·DB·인프라)
- **외부 의존 서비스**
- **보안 / 성능 / 관찰성 주요 결정**
- **구현 순서 제안** (아키텍처 문서에 있으면 활용)

### 감지 불가 시
PRD 또는 아키텍처 문서에 위 정보가 현저히 부족하면:
- 부족한 항목을 나열
- 사용자에게 "PRD/아키텍처를 먼저 보완하시겠습니까, 아니면 현재 내용으로 진행하겠습니까?" 질의
- 현재 내용으로 진행하는 경우 Plan 문서에 "**가정**" 섹션에 추정 근거 명시

### Design 산출물 자동 감지 (선택)

`${CLAUDE_PROJECT_DIR}/docs/design/$NAME/` 디렉터리가 존재하면 추가 입력으로 로드. 아래 로직은 **실제 bash 실행이 아닌** Claude 의 내부 판단 절차를 기술한다 — 디렉터리 존재 확인과 트랙 목록 산출에 사용.

```bash
DESIGN_DIR="${CLAUDE_PROJECT_DIR}/docs/design/$NAME"
DESIGN_TRACKS=""
if [ -d "$DESIGN_DIR" ]; then
  for f in api.md ui.md mockup.md; do
    if [ -f "$DESIGN_DIR/$f" ]; then
      DESIGN_TRACKS="${DESIGN_TRACKS}${DESIGN_TRACKS:+, }${f%.md}"
    fi
  done
fi
```

존재하는 파일만 `Read`:
- `api.md` 가 있으면 → API 엔드포인트 목록을 Story 경계 힌트로 활용 (엔드포인트당 Story/Task 하나 이상)
- `ui.md` 가 있으면 → 컴포넌트 인벤토리를 frontend Story 의 Task 분해 힌트로 활용
- `mockup.md` 가 있으면 → 화면 리스트를 유스케이스 매핑 확인용 참조

**디렉터리가 없으면 완전히 무시** — 경고·안내 없이 기존 plan 로직 그대로.

## 3단계: 스택 감지 및 관련 표준 로드

아키텍처 문서의 "기술 스택" 섹션을 기반으로 `${CLAUDE_PROJECT_DIR}/docs/standards/` 에서 관련 문서 자동 로드:

- Spring Boot / Java / JPA → `${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/*.md`
- Next.js / TypeScript → `${CLAUDE_PROJECT_DIR}/docs/standards/backend/nextjs-typescript/*.md` (+ `frontend/*.md` if UI 있음)
- FastAPI / Python → `${CLAUDE_PROJECT_DIR}/docs/standards/backend/fastapi/*.md`
- DB 관련 Story 포함 가능성 높음 → `${CLAUDE_PROJECT_DIR}/docs/standards/database/*.md` 전부
- UI 있으면 → `${CLAUDE_PROJECT_DIR}/docs/standards/frontend/*.md`

읽은 표준은 Story 분해·Task 도출 시 "실제 필요한 작업" (테스트·보안·로깅 등)을 떠올리는 데 사용.

## 4단계: 참석자 선정 및 페르소나 로드

기본 참석자:
- **`facilitator`** (자동)
- **`scrum-master`** (Epic·Story 분해 주도)
- **`planner`** (일정·의존성 담당)
- **`architect`** (설계 정합성 확인)

주제에 따라 추가:
- 백엔드 작업 있으면 → `backend`
- 프론트엔드 작업 있으면 → `frontend`
- DB 스키마 변경 있으면 → `data`
- 테스트 전략 필요하면 → `qa`
- 보안 결정 포함되면 → `compliance`
- 출시 시점 중요하면 → `pm`

각 페르소나의 `${CLAUDE_PLUGIN_ROOT}/agents/<이름>.md`를 `Read`로 로드.

## 5단계: 계획 회의 진행 (4라운드 구조)

메인 Claude가 **진행자**와 **각 페르소나** 역할을 동시에 수행, 하나의 응답 안에서 진행.

각 발언 형식:
```
**[이모지] [이름] ([역할]):**
(3-6 문단)
```

### Round 1: Epic 도출 (5-8분량)

**진행자 오프닝**:
- PRD·아키텍처 요약 (각 2-3줄)
- Epic 도출 시작 선언

**참여**: scrum-master, architect, pm

**목표**: PRD의 기능 요구사항을 **Epic 단위**로 묶기. 보통 3-8개.

Epic 조건:
- 비즈니스 가치 단위
- 3-5일 이상의 통합 작업
- PRD의 주요 섹션 하나 ≈ Epic 하나

출력 예:
```
Epic E1: 사용자 인증
Epic E2: 상품 카탈로그
Epic E3: 장바구니·결제
Epic E4: 주문 관리
```

### Round 2: Story 분해 (라운드에서 가장 긴 부분)

각 Epic마다 순서대로 진행:

**참여**: scrum-master (주도), architect, backend/frontend/data/qa (주제별)

**목표**: 각 Epic을 **수직 슬라이스 Story**로 분해

Scrum Master가 각 Epic을 3-7개 Story로 쪼개고, 각 Story마다:
- **ID**: E1-S1 형식
- **제목**: 동사로 시작, 사용자 관점
- **설명**: 1-2문장
- **수용 기준 (AC)**: 2-5개, Given-When-Then
- **T-shirt size**: S/M/L/XL
- **담당 영역**: backend / frontend / data / mobile / mixed

구현 페르소나가 공수·실현 가능성 검증 ("이거 L이다", "XL인데 쪼개야 한다").

XL 나오면 즉시 재분해.

### Round 3: Task 분해

각 Story를 2-5개 Task로 분해.

Task 형식:
- **ID**: E1-S1-T1
- **제목**: 구체적 작업 (코드·DB·설정·테스트)
- **담당**: backend / frontend / data / qa
- **T-shirt size**: S/M (대부분 S-M, L 이상은 Story로 쪼개야 신호)

Task 예:
```
E1-S1-T1: users 테이블 마이그레이션 작성 (data, S)
E1-S1-T2: POST /api/v1/auth/signup 엔드포인트 (backend, M)
E1-S1-T3: 회원가입 폼 UI (frontend, M)
E1-S1-T4: 통합 테스트 작성 (qa, S)
```

### Round 4: 의존성·일정·리스크

**진행자**: Planner

**목표**:
1. **의존성 식별** — 하드 블로킹 / 소프트 의존 / 독립
2. **크리티컬 패스** 추출
3. **병렬화 가능 트랙** 식별
4. **마일스톤** 제안 (2-4주 간격)
5. **리스크** 분류 (🔴/🟡/🟢) 및 완화책
6. **버퍼** 명시 (전체의 20%)

각 전문가가 자기 영역의 숨은 의존성·리스크 제기 (예: Compliance가 "인증 통합 전에 보안 리뷰 필요", Data 엔지니어가 "이 마이그레이션은 온라인으로 안 됨, 다운타임 필요").

## 6단계: 산출물 작성

두 개의 파일을 생성한다:

### 6.1 메인 계획 문서 (`$OUT`)

Plan 문서 형식은 `${CLAUDE_PLUGIN_ROOT}/templates/reports/plan/plan.md` 에 정의돼 있다. 해당 파일을 `Read` 해서 템플릿으로 쓰고, 1~5 단계에서 수집·회의한 내용으로 `<...>` 플레이스홀더를 채워 `$OUT` 에 쓴다.

핵심 준수 사항:
- **참조 Design 라인 규칙**: design 디렉터리가 없거나 `DESIGN_TRACKS` 가 빈 문자열이면 `- **참조 Design**: ...` **라인 전체를 삭제** — 빈 괄호·빈 트랙 문자열 금지.
- Story 헤더 포맷 `#### E<i>-S<j>:` 는 그대로 유지 (후속 `/sdlc:story`, `/sdlc:auto-epic` 이 이 패턴으로 Story 를 추출).
- 각 Story 의 `- **수용 기준**:`, `- **DoD**:`, `**Task**:` 섹션 키는 정확히 유지 — story 커맨드의 2 단계 파싱이 이에 의존.
- Task 테이블 컬럼은 `ID | 제목 | 담당 | 크기` 순서 고정.

### 6.2 의존성 다이어그램 파일 (`$OUT` 의 `.md` 앞에 `.deps` 삽입)

산출물 경로 `$OUT` 이 `${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.md`라면, 의존성 파일은 `${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.deps.md`.

포맷은 `${CLAUDE_PLUGIN_ROOT}/templates/reports/plan/deps.md` 에 정의돼 있다. `Read` 해서 템플릿으로 쓰고, 4 단계 Round 4 에서 도출한 의존성·크리티컬 패스·트랙·외부 의존성 정보로 채운다.

핵심 준수 사항:
- mermaid 엣지 구문은 정확히 유지 — `/sdlc:auto-epic` 의 deps 파서 ([commands/auto-epic.md:90-94](commands/auto-epic.md#L90-L94)) 가 이 패턴을 정규식으로 매칭.
  - 하드 의존: `E1S1 --> E1S2`
  - 소프트 의존: `E1S1 -.-> E1S2`
- Story 노드 ID 는 하이픈 없이 붙여쓴다 (`E1S1`). Story ID 자체는 `E1-S1` 이지만 mermaid 안에서는 `[E1-S1: 제목]` 라벨로 표기.
- `classDef critical` 과 `class ... critical` 문법은 유지 — 크리티컬 패스 Story 만 `class` 에 등재.

## 7단계: 최종 보고

```
✅ 실행 계획 생성 완료

입력:
- PRD: {$PRD}
- 아키텍처: {$ARCH}

산출물:
- 계획: {$OUT}
- 의존성: {$OUT 에서 .md 앞에 .deps 삽입한 경로}

요약:
- Epic N개 / Story M개 / Task K개
- 예상 기간 N주 (버퍼 포함)
- 마일스톤 M개
- 크리티컬 패스: E1-S1 → ... → EN-SM
- 주요 리스크: 🔴 N건 / 🟡 M건

다음 단계 제안:
- [ ] 팀 리뷰로 Story·Task 확정
- [ ] XL Story (있다면) 재분해
- [ ] 스파이크 Task (리스크 높은 불확실성) 우선 시작
- [ ] 프로젝트 관리 도구(Jira·Linear·GitHub)에 업로드
```

## 8단계: 주의사항

- **회의 전체를 하나의 Claude 응답에서** 끝내라. 중간에 "계속할까요?" 묻지 마라.
- **PRD/아키텍처에 명시 안 된 가정**은 반드시 "가정 및 미결 사항" 섹션에 기록.
- **XL Story**는 항상 재분해. 예외 없음.
- **DoD는 각 Story마다** — 복붙이라도 포함.
- **크리티컬 패스는 반드시 시각화** (다이어그램에 빨간 색).
- **버퍼 없이 마감일 제시 금지**.
- 산출물 경로의 상위 디렉터리 없으면 먼저 `mkdir -p`.
- 의존성 파일명은 메인 계획 파일명 + `.deps.md`.
- 페르소나가 특정 숫자·기술에 확신 없으면 "확인 필요"로 표기.
