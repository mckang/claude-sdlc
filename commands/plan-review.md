---
argument-hint: [Plan파일|feature이름, 생략 시 current] [산출물경로, 생략 시 자동] [--scope=all|m1|epic:E1]
description: Plan 문서를 팀 페르소나가 4축으로 리뷰해 Finding·수정 제안 리포트 생성
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 팀 리뷰 (Plan Review) 세션

사용자가 `/plan-review [Plan|feature이름] [산출물경로] [--scope=...]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:plan-review                                             # current feature 사용 (자동 산출물)
/sdlc:plan-review checkout-v2 --scope=m1                      # feature 이름 + 스코프
/sdlc:plan-review docs/plans/plan-x.md docs/plans/plan-x.review.md --scope=epic:E5   # 명시 경로
```

본 명령의 목적:
- `/plan` 이 생성한 Plan 을 팀이 확정하기 전에 **페르소나 기반 사전 리뷰**로 약점을 미리 잡는다.
- **4축 고정 리뷰** — Epic 경계 / Story 품질 / AC 모호성 / 의존성 누락. 여기에 **보조 축 3개** — DoD 완전성 · 표준 위반 · Bus factor 1 · 리스크 커버리지.
- 리뷰 결과를 **수용·거절·보류 3단계 Finding** 으로 기록. 사용자가 Finding 을 보고 Plan 수정 여부를 결정.

## 1단계: 인자 파싱 및 검증

- `$1`: Plan 파일 경로 또는 feature 이름 (선택 — 생략 시 current feature)
- `$2`: 리뷰 리포트 저장 경로 (선택 — 생략 시 Plan 경로 기반 자동 생성)
- 스코프 플래그 (선택):
  - `--scope=all` (기본) — Plan 전체
  - `--scope=m1` / `--scope=m2` ... — 특정 마일스톤 Story 만
  - `--scope=epic:E1` / `--scope=epic:E5` ... — 특정 Epic Story 만

### Plan 경로 및 산출물 경로 resolve

```bash
POS=()
for a in "$@"; do
  case "$a" in --*) ;; *) POS+=("$a") ;; esac
done

OUT_ARG=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-plan-path.sh" "${POS[0]:-}") || exit 1
NAME=$(sed -n 1p <<<"$OUT_ARG")
PLAN=$(sed -n 2p <<<"$OUT_ARG")
test -f "$PLAN" || { echo "❌ Plan 파일 없음: $PLAN"; exit 1; }

OUT="${POS[1]:-${PLAN%.md}.review.md}"
mkdir -p "$(dirname "$OUT")"
```

## 2단계: 입력 문서 로드

### 2-1. Plan 본문 및 메타데이터
`Read` 로 Plan 파일을 읽고 다음 추출:
- 제목 · 작성일 · 참조 PRD · 참조 아키텍처 · 참조 표준 · 기술 스택
- 총 Epic/Story/Task 수
- Story 담당 영역(`담당 영역: backend/frontend/data/qa/compliance/pm/...`)
- T-shirt size 분포 (S/M/L/XL 개수)
- 마일스톤·크리티컬 패스·리스크 목록

### 2-2. 의존성 파일
`<plan-basename>.deps.md` 존재 시 `Read`. 없으면 경고만:
> `.deps.md` 파일이 없습니다. 의존성 축(4번째) 리뷰는 Plan 본문 표에서 추출한 정보만으로 진행합니다.

### 2-3. 참조 문서 (리뷰 근거)
Plan 의 참조 섹션에서 경로 추출 후 `Read`:
- PRD (`${CLAUDE_PROJECT_DIR}/docs/prd/*.md`)
- 아키텍처 (`${CLAUDE_PROJECT_DIR}/docs/architecture/architecture.md`)
- 프로젝트 표준 (`${CLAUDE_PROJECT_DIR}/docs/architecture/standard.md` 이 있으면 우선)
- 일반 표준 (`${CLAUDE_PROJECT_DIR}/docs/standards/` 중 Plan 의 기술 스택에 맞는 문서)

**스택 감지 기반 표준 로드**:
- FastAPI → `${CLAUDE_PROJECT_DIR}/docs/standards/backend/fastapi/*.md`
- Next.js → `${CLAUDE_PROJECT_DIR}/docs/standards/backend/nextjs-typescript/*.md` (+ frontend)
- Spring Boot → `${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/*.md`
- DB 관련 Story 있으면 → `${CLAUDE_PROJECT_DIR}/docs/standards/database/*.md`

## 3단계: 스코프 필터링

`--scope` 값에 따라 대상 Story 선별:
- `all`: 전체 Story
- `m1`/`m2`/...: 해당 마일스톤 게이트에 포함된 Story (Plan 의 "마일스톤별 완료 Story" 또는 본문 매핑)
- `epic:E1`: `E1-S*` 패턴의 Story 만

리뷰 대상 Story 개수를 오프닝에서 명시.

## 4단계: 참석자 선정

**필수 참석자**:
- `facilitator` (Sean) — 진행·정리
- `scrum-master` (Marco) — Story 품질 · DoD · XL 탐지 주도
- `planner` (Iris) — 의존성 · 크리티컬 패스 · 일정 주도
- `architect` (Winston) — 표준 위반 · 설계 정합성
- `techlead` (Sam) — Bus factor · 유지보수성 · 표준 예외 판단

**자동 추가** (Plan 의 담당 영역에 나타난 경우):
- `backend` → `backend`
- `frontend` → `frontend`
- `data` → `data`
- `qa` → `qa`
- `compliance` → `compliance`
- `pm` → `pm`

상한 8명. 넘으면 Plan 에 가장 많이 등장한 담당 영역 우선.

각 페르소나 `${CLAUDE_PLUGIN_ROOT}/agents/<이름>.md` 를 `Read` 로 로드.

## 5단계: 4+3 축 리뷰 회의 진행

메인 Claude 가 **진행자(Sean)** 와 **각 참석자** 를 동시 수행. 하나의 응답 안에서 끝냄.

발언 형식:
```
**[이모지] [이름] ([역할]):**
(3-5 문단, 구체적 근거 제시)
```

### 5-0. 오프닝 (Sean)

- 리뷰 대상 Plan 요약 (Epic N / Story M / Task K / 기간 / 참석자)
- 스코프 명시
- 리뷰 규칙:
  - **Finding 은 ID + 심각도 + 근거 + 권고안** 4요소 필수
  - 심각도: 🔴 Blocker (확정 전 반드시 해소) / 🟡 Concern (확정 가능, 착수 전 검토) / 🟢 Nitpick (수용 여부 선택)
  - 근거는 **참조 문서 섹션 인용** 또는 **구체적 Story ID·AC**
- Finding 누적 카운터 소개

### 5-1. Round 1 — Epic 경계 (Scrum Master + Architect + PM)

**검토 질문**:
- Epic 이 **너무 크지 않은가** (다른 프로젝트 하나만큼?). 비즈니스 가치 단위로 쪼개기 어려운 크기?
- Epic 이 **너무 작지 않은가** (단일 Task 수준? Story 로 흡수 가능?)
- Epic 간 **책임 중첩** 은 없는가 (두 Epic 이 같은 모듈·테이블을 만지면 머지 충돌 위험)
- Epic **누락** 은 없는가 (PRD 의 기능 요구사항 중 어느 Epic 에도 매핑 안 되는 항목)
- Epic 이 **모듈 경계**(아키텍처 §3.2 또는 유사 섹션)와 충돌하지 않는가

Marco 가 Epic 리스트를 순회하며 크기·중첩 지적. Winston 이 모듈 경계 정합성. John 이 비즈니스 단위 완전성.

**출력**: Finding F-E-001, F-E-002, ... (E = Epic 축)

### 5-2. Round 2 — Story 품질 (Scrum Master + 담당 영역 페르소나)

**검토 질문 (Story 전수)**:
- **INVEST**:
  - Independent: 다른 Story 없이 독립 가치?
  - Negotiable: 세부 조정 가능?
  - Valuable: 사용자·비즈니스 가치?
  - Estimable: 크기 추정 가능?
  - Small: 1 스프린트 내?
  - Testable: AC 명확?
- **XL 탐지**: L 또는 XL 로 태그된 Story 는 **반드시 재분해 제안**. L 이 실제로는 XL 숨겨진 경우도 탐지 (Task 개수 > 6, 다른 Story 와 트랜잭션·DB 스키마 연결)
- **수직 슬라이스**: Story 가 "DB 만", "UI 만" 같은 수평 슬라이스가 아닌가
- **DoD**: 공통 DoD + Story 특수 기준이 있는가. 수치 기준이 "빠르게"/"적절히" 같은 모호어로 되어 있지 않은가
- **Task 분해**: Task 가 2-5개인가. 10개 넘으면 Story 를 쪼개야 한다는 신호

Story 가 많으면 **샘플링 + 문제 있는 것 전수** 원칙:
- 크기 L/XL 은 전수
- 크기 M 은 담당 영역별 무작위 2-3개
- 크기 S 는 무작위 샘플 (공통 패턴 확인용)

**출력**: Finding F-S-001, F-S-002, ... (S = Story 축)

### 5-3. Round 3 — AC 모호성 (QA + Scrum Master)

**검토 질문 (Story 의 AC 전수)**:
- AC 가 **Given-When-Then** 구조를 따르는가 (필수는 아니지만 누락되면 측정 가능성 저하)
- **측정 불가 표현** 포함? — "빠르게"/"안정적"/"적절히"/"사용자 친화적"/"에러 없이"/"잘" 등
- **경계값** 누락? — min/max, 0/1/N, 빈 문자열, 매우 긴 입력, 유니코드
- **실패 경로** 누락? — happy path 만 있고 4xx/5xx/타임아웃 없음
- **비결정 요소** 처리? — 동시성·시간·외부 호출 의존 AC 는 어떻게 검증?

Quinn 이 AC 를 실제 테스트 코드로 변환 가능한지 기준으로 공격. Marco 가 INVEST 의 T(Testable) 위반 판정.

**출력**: Finding F-A-001, F-A-002, ... (A = AC 축)

### 5-4. Round 4 — 의존성 누락 (Planner + Architect + 담당 영역)

**검토 질문**:
- Plan 본문 또는 `.deps.md` 의 의존성 그래프에서 **누락된 하드 블로킹** 은 없는가
  - 예: Story X 가 Story Y 의 테이블·API 를 쓰는데 Y → X 화살표 없음
- **소프트 의존** 으로 낮출 수 있는 하드 블로킹은 없는가 (Mock 도입으로 병렬화 기회)
- **외부 의존성** 누락 (법무 검토, 인프라 프로비저닝, 제3자 API 승인, 타 팀 산출물)
- **크리티컬 패스** 가 올바른가 — 가장 긴 체인이 맞는가
- **병렬화 트랙** 배정이 팀 용량과 맞는가 (한 사람에 트랙 2개 이상 몰리면 병목)
- **순환 의존** 은 없는가

Iris 가 다이어그램을 검토하고 누락된 화살표 지적. Winston 이 모듈 경계 기반 숨은 의존 탐지.

**출력**: Finding F-D-001, F-D-002, ... (D = Dependency 축)

### 5-5. Round 5 — 보조 축 (Tech Lead + Architect + 전체)

**5-5-1. DoD 완전성** (Marco):
- 모든 Story 가 **공통 DoD** (표준의 PR 체크리스트) + **Story 특수 DoD** 갖는가
- 테스트 유형·커버리지 기준이 명시돼 있는가 (단위/통합/동시성/E2E)
- 표준 §10.3 PR 체크리스트 와 정합하는가

**5-5-2. 표준 위반** (Winston + 담당 영역):
- 프로젝트 표준 (`${CLAUDE_PROJECT_DIR}/docs/architecture/standard.md`) 과 Plan 의 접근이 **충돌** 하는가
- 일반 표준 (`${CLAUDE_PROJECT_DIR}/docs/standards/`) 의 "금지 사항" 을 Plan Task 가 유발하는가
- Plan 이 예외를 정당화 없이 도입하지는 않는가 (예외는 표준 PR 로 갱신해야 함)

**5-5-3. Bus factor 1** (Sam):
- 특정 Story 가 **한 사람만 이해할 수 있는 복잡도** 를 갖는가
  - 동시성·경합 복구·암호학·외부 시스템 프로토콜 등
- 페어 프로그래밍 또는 문서화 의무가 DoD 에 포함돼 있는가

**5-5-4. 리스크 커버리지** (Iris + 전체):
- Plan 의 리스크 섹션이 **다음 리스크 카테고리** 를 커버하는가
  - 외부 결정 대기 (타깃 인프라, 서드파티 승인)
  - 기술 불확실성 (처음 쓰는 라이브러리·프로토콜)
  - 운영 리스크 (인덱스 유실, 이벤트 유실, 동시성 파괴)
  - 인적 리스크 (Bus factor, 휴가, 페어 가용성)
- 각 리스크에 **완화 전략 + 담당자** 가 있는가 (없으면 의미 없음)
- **완화 전략이 측정 가능** 한가 ("잘 관찰한다" X, "임계 초과 시 슬랙 알람" O)

**출력**: Finding F-X-001, F-X-002, ... (X = aXillary 보조 축)

### 5-6. Round 6 — Finding 합의 및 분류 (Facilitator)

Sean 이 누적된 Finding 을 **표** 로 정리:

```markdown
| ID | 축 | 심각도 | 대상 | 요약 | 권고 |
|----|----|--------|------|------|------|
| F-E-001 | Epic | 🟡 | E4 (검증 모듈) | 크기 S 3개로 단일 Epic 으로 두기엔 작음 | E2 또는 E5 하위 Story 로 흡수 |
| F-S-001 | Story | 🔴 | E5-S2 | L 태깅이지만 Task 5개 + outbox insert 와 커플링 → 실제 XL | 순수 검증 호출 / COMPLETED 전환 2개로 분할 |
| F-A-001 | AC | 🟡 | E5-S6 AC-3 | "조용히 skip" 만 명시, 무엇이 fail 신호인지 불명 | "Supabase local 미기동 시 pytest exit code != 0 + stderr 에 ...' 로그" |
| F-D-001 | 의존성 | 🟡 | E7-S2 | OpenAPI 미들웨어 스파이크 실패 시 fallback 경로가 의존 그래프 미반영 | deps 에 E7-S2 → CI schemathesis 분기 점선 추가 |
| F-X-001 | 표준 | 🔴 | 전반 | `raise HTTPException` 금지 (표준 §3.5) CI grep-gate 가 E7-S1-T3 Task 로만 있음. 실제로 Day 1 부터 적용되지 않으면 이후 Story 들이 위반 | E1-S2 make ci 에 포함시켜 프로젝트 초기부터 가드 |
```

각 Finding 에 **권고 상태** 표시:
- ✅ 수용 (Plan 수정 필요)
- 🔍 보류 (사용자 결정 필요)
- ❌ 거절 (Finding 자체가 부적절 — 페르소나 합의로 철회)

합의 안 되는 Finding 은 **보류** 로 남겨 사용자에게 결정 요청.

### 5-7. 클로징 (Sean)

- Finding 총 N개 (🔴 X / 🟡 Y / 🟢 Z)
- **🔴 Blocker 는 Plan 수정 PR 전에 반드시 해소** 메시지
- **🟡 Concern 은 해당 Story 착수 전 재검토** 메시지
- 산출물 파일 경로 안내

## 6단계: 산출물 작성

`$OUT` 경로에 다음 형식으로 저장:

```markdown
# 팀 리뷰: {Plan 제목}

- **리뷰일**: YYYY-MM-DD
- **대상 Plan**: {Plan 경로} ({최신 수정일})
- **스코프**: {all | m1 | epic:E1 ...}
- **참석자**: {페르소나 목록}
- **참조 문서**:
  - PRD: ...
  - 아키텍처: ...
  - 표준: ...

## 요약

| 축 | 🔴 Blocker | 🟡 Concern | 🟢 Nitpick | 합계 |
|----|-----------|-----------|-----------|------|
| Epic 경계 | N | N | N | N |
| Story 품질 | N | N | N | N |
| AC 모호성 | N | N | N | N |
| 의존성 누락 | N | N | N | N |
| 보조 (DoD/표준/Bus/리스크) | N | N | N | N |
| **총계** | **N** | **N** | **N** | **N** |

**Blocker 해소 전 Plan 확정 금지**.

## Finding 상세

### F-E-001 — Epic 경계: {한 줄 요약}
- **심각도**: 🔴 | 🟡 | 🟢
- **대상**: {Epic/Story ID 또는 전반}
- **근거**: {참조 문서 섹션 인용 또는 Plan 의 구체 위치}
- **발견자**: {페르소나 이름}
- **권고**: {구체적 수정안 — Plan 의 어느 섹션을 어떻게 바꿀지}
- **상태**: ✅ 수용 | 🔍 보류 | ❌ 거절

### F-S-001 — Story 품질: ...
...

### F-A-001 — AC 모호성: ...
...

### F-D-001 — 의존성 누락: ...
...

### F-X-001 — 보조 축(표준/DoD/Bus/리스크): ...
...

## 수용된 Finding 에 대한 Plan 수정안

다음 Finding 은 Plan 에 반영 필요 (사용자 확정 시 `/scope-change` 또는 직접 편집):

| Finding ID | Plan 수정 방향 | 예상 영향 |
|------------|---------------|-----------|
| F-S-001 | E5-S2 를 E5-S2a/S2b 로 분할 (L→M+S) | Story +1, Task 재배분 |
| F-X-001 | E1-S2 Makefile 에 `raise HTTPException` grep-gate 추가 | Task 1개 이동 |
| ... |

## 보류 Finding — 사용자 결정 요청

| Finding ID | 질문 | 옵션 |
|------------|------|------|
| F-E-001 | E4(검증 모듈)를 독립 Epic 으로 유지할지, E5 하위 Story 로 흡수할지 | (a) 유지 (TDD 의무 가시성) / (b) 흡수 (Epic 수 감소) |
| ... |

## 회의 로그

(전체 리뷰 대화 발언 순서·헤더 보존)

## 다음 단계

1. 🔴 Blocker {N}건 먼저 해소
2. 수용 Finding 을 Plan 에 반영 (`/scope-change` 권장 또는 직접 편집)
3. 보류 Finding 에 대해 팀 의사결정
4. 재리뷰 필요 시 `/plan-review` 재실행 (Finding ID 가 이어지도록 기존 리포트 append)
```

## 7단계: Plan 에 리뷰 흔적 남기기 (옵션)

Plan 상단에 "## 📝 리뷰 이력" 섹션 없으면 생성, 있으면 append:

```markdown
## 📝 리뷰 이력

### 2026-04-21 — 팀 리뷰 #1
- 리포트: [plan.review.md](plan.review.md)
- Finding: 🔴 {N} / 🟡 {M} / 🟢 {K}
- Blocker 해소 전 상태: **draft**
```

이 작업은 **사용자 확인 후** 수행 — 자동으로 Plan 에 쓰지 말 것.

## 8단계: 최종 보고

```
✅ 팀 리뷰 완료

대상: {$PLAN}
스코프: {all/m1/...}
참석자: {N명}

Finding: 총 {N}건
- 🔴 Blocker {X}건 (Plan 확정 전 반드시 해소)
- 🟡 Concern {Y}건 (해당 Story 착수 전 재검토)
- 🟢 Nitpick {Z}건 (선택적 개선)

산출물: {$OUT}

핵심 Blocker {상위 3건 요약}:
- F-X-001: ...
- F-S-001: ...
- F-D-001: ...

다음 단계:
1. Blocker Finding 해소 PR 작성
2. 보류 Finding 사용자 결정
3. 수정 후 /plan-review 재실행 (옵션)
4. Plan 확정 → /story kickoff E1-S1 로 실제 구현 시작
```

## 주의사항

- **한 응답 안에서 전체 리뷰 끝** — 중간에 "계속할까요?" 묻지 마라.
- **Finding 은 항상 ID + 심각도 + 근거 + 권고 + 상태** 5요소 필수. 누락 시 불완전 리뷰.
- **근거는 참조 문서 섹션 인용 또는 구체 Story·AC** — "느낌상 이상해요" 금지.
- **Blocker 는 엄격하게** — 남발하면 의미 상실. 실제로 착수 전 해소 안 하면 위험한 것만.
- **Plan 자동 수정 금지** — 리뷰 리포트는 제안이지 결정이 아님. 사용자가 확정 후에만 Plan 수정.
- **스코프 플래그가 있으면 대상 Story 명시** — 전체 Plan 을 리뷰하는 척하지 않는다.
- **참석자 명단 밖 페르소나 언급 금지**.
- 산출물 디렉터리 없으면 `mkdir -p`.
- 산출물 경로가 Plan 과 같은 디렉터리이면 관례 유지 (`<plan>.review.md`).

## 특수 상황

### Plan 이 이미 리뷰된 적 있음
- Plan 상단에 "📝 리뷰 이력" 이 있으면, 이전 리뷰 리포트도 `Read` 해서 **이전 Blocker 가 해소됐는지 확인**.
- 해소되지 않은 Blocker 가 여전히 남아 있으면 새 Finding 에 `(재발견)` 표시.

### Plan 이 `/scope-change` 로 수정됨
- "🔄 변경 이력" 섹션 있으면 최근 변경을 우선 리뷰 대상으로 포함.

### Story 진행 중 상태 (`[~]` 또는 `[x]`)
- 이미 진행/완료된 Story 에 대한 Blocker Finding 은 **🟡 Concern 으로 강등** — 착수 전 개입은 불가, 회고에서 다뤄야 함.
- 리포트에 "진행 중 Story 개입 제한" 주석 포함.

### `.deps.md` 없음
- Round 4 는 Plan 본문의 의존성 표·설명만 기반으로 진행.
- Finding 에 "의존성 파일 부재로 그래프 검증 제한" 명시.

## 에러 처리

- Plan 파일 없음 → 중단.
- 참조 문서(PRD/아키텍처/표준) 없음 → 경고 + 해당 축 리뷰 제한 명시. 중단하지는 않음.
- 페르소나 파일 없음 (`${CLAUDE_PLUGIN_ROOT}/agents/<이름>.md`) → 해당 페르소나 제외하고 진행, 리포트에 "페르소나 부재" 명시.
- 산출물 경로 쓰기 실패 → 중단.

## 팁

- 리뷰는 **Plan 생성 직후 즉시** 실행이 가장 효과적 (맥락 신선).
- 🔴 Blocker 가 반복적으로 "표준 위반" 에서 나오면 **표준 문서 자체가 모호** 하다는 신호 — 표준 갱신 검토.
- Finding 축별 분포가 심하게 불균등하면 (예: AC 축에 몰림) **Plan 작성자 패턴 문제** — 회고에서 다룸.
- 같은 Story 에 3건 이상 Finding 이 나오면 **해당 Story 를 통째로 재분해** 권고.
