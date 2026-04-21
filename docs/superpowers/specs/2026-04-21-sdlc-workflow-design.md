# SDLC 워크플로우 설계: feature → PRD → architecture → plan → story → e2e

- **작성일**: 2026-04-21
- **대상 버전**: sdlc v1.1.0
- **상태**: design

## Context

sdlc-plugin은 `/sdlc:plan`과 `/sdlc:story`를 중심으로 이미 Plan·Story·Task 분해와 개발 사이클을 지원한다. 그러나 **그 앞 단계**(요구사항 수집 → PRD → 아키텍처)가 `/sdlc:meeting` 하나에 묶여 있어, 초기 산출물이 미팅 기록(`docs/meetings/`)에 섞여 추적성과 재생성 가능성이 떨어진다.

본 설계는 개발 전 과정을 **6개의 독립 단계**로 분리하고, 각 단계에 **전용 커맨드**와 **고정 산출물 경로**를 부여한다. 단계 간 handoff는 "직전 단계의 문서 경로"로 단순화한다.

## 목표

- 각 단계의 산출물이 **독립 파일**로 저장되어 버전 관리·리뷰 단위가 명확해짐
- 단계 간 handoff가 **문서 경로 하나**로 단순화되어 후속 커맨드가 직전 단계를 신뢰할 수 있음
- 기존 `/sdlc:meeting`, `/sdlc:plan`, `/sdlc:story`의 하위호환 유지
- 중간 단계에서의 **사용자 승인 지점**을 명시적으로 보존 (자동 체인 실행 금지)
- `/sdlc:feature` 가 **Current Feature** 를 `CLAUDE.md` 에 등록해, 후속 커맨드가 이름 인자 생략 시 이를 기본값으로 resolve

## 비목표

- 단계 간 자동 실행 파이프라인 (각 단계는 사용자 트리거)
- PRD → feature.md 역방향 생성
- E2E 테스트 자동화 커맨드 (`/sdlc:story verify/complete`가 계속 담당)
- 신규 페르소나 추가 (기존 21명 활용)

---

## 파이프라인 개요

```
  ┌────────────┐   ┌────────────┐   ┌────────────────┐   ┌──────────┐   ┌───────────┐   ┌─────────┐
  │ /sdlc:     │   │ /sdlc:     │   │ /sdlc:         │   │ /sdlc:   │   │ /sdlc:    │   │ /sdlc:  │
  │  feature   │──▶│   prd      │──▶│  architecture  │──▶│   plan   │──▶│   story   │──▶│  story  │
  │            │   │            │   │                │   │          │   │  (start)  │   │ (verify │
  └────────────┘   └────────────┘   └────────────────┘   └──────────┘   └───────────┘   │ /complete)│
        │                │                   │                 │              │         └─────────┘
        ▼                ▼                   ▼                 ▼              ▼              │
  docs/features/   docs/prd/          docs/architecture/  docs/plans/   코드·브랜치          ▼
  feature-         prd-              architecture-       plan-                         AC·DoD 검증
  <name>.md        <name>.md         <name>.md           <name>.md                       + E2E
```

- 각 커맨드는 직전 단계의 산출물을 **입력**으로 요구한다.
- 입력이 없으면 커맨드는 **실행을 거부**하고 이전 단계 실행을 안내한다.
- `<name>`은 kebab-case feature 식별자 (예: `checkout-v2`, `html5-tetris`).
- **산출물 파일명 규약**: `docs/<type>/<type>-<name>.md` — 파일명만 봐도 타입이 식별되고, 여러 feature 의 산출물이 같은 디렉토리에 있어도 충돌·혼동이 없다.

---

## 단계별 상세

### 1. `/sdlc:feature [name]`

**역할**: 사용자와 **자유 대화**로 만들고 싶은 것과 기능들을 수집해 **기능 리스트** 로 가볍게 정리한다. PRD 의 씨앗이며 **반~1페이지 이내**. FR/NFR·페르소나·성공지표는 여기서 다루지 않는다 (PRD 영역).

- **주도 페르소나**: `pm` (1:1 대화)
- **입력**: feature 이름 (선택 — 없으면 대화 중 함께 정함)
- **출력**: `${CLAUDE_PROJECT_DIR}/docs/features/feature-<name>.md` + CLAUDE.md 의 Current Feature 갱신
- **대화 패턴**:
  1. "무엇을 만들고 싶은지 한두 문장으로" → 사용자 응답 후 PM 이 한 줄 확인
  2. 식별자(kebab-case) 미정이면 제안·확정
  3. "어떤 기능들을 넣고 싶으세요?" → 떠오르는 대로 자유 나열
  4. 대여섯 개쯤 쌓이면 중간 요약 + **핵심(1차) / 나중 고려** 가지치기 제안
  5. 사용자가 "충분하다" 하면 종료 (목표 5분 이내)

**템플릿**:
```markdown
# Feature: <한 줄 요약>

- **식별자**: <name>
- **작성일**: YYYY-MM-DD
- **작성자**: <오너 또는 현재 사용자>
- **상태**: draft

## 개요
(1-3문장, 사용자 언어 유지)

## 기능

### 핵심 (1차)
- ...

### 나중 고려
- ...

## 결정 필요
- [ ] (답 못 했거나 오너 판단이 필요한 항목)

## 다음 단계
- [ ] 공식 PRD 로 발전: `/sdlc:prd <name>`
```

### 2. `/sdlc:prd <name>`

**역할**: `docs/features/feature-<name>.md`를 입력으로 **공식 PRD**를 생성한다. PM + 도메인 전문가 페르소나를 소환해 FR/NFR 수준까지 구체화.

- **주도 페르소나**: `pm` (+ 주제 기반으로 `techlead`, `ux`, `security`, `analyst` 등 선택적 참여)
- **입력**: `${CLAUDE_PROJECT_DIR}/docs/features/feature-<name>.md` (필수)
- **출력**: `${CLAUDE_PROJECT_DIR}/docs/prd/prd-<name>.md`
- **사전조건**: feature.md 존재. 없으면 `/sdlc:feature <name>` 먼저 실행하도록 안내하고 종료.
- **인자**: 이름 생략 시 CLAUDE.md 의 Current Feature 사용.

**필수 섹션**:
```markdown
# PRD: <제목>

- **식별자**: <name>
- **작성일**: YYYY-MM-DD
- **참조 feature**: docs/features/feature-<name>.md
- **상태**: draft | approved | in_development | shipped

## 개요
(2-4문장)

## 배경 / 동기
## 페르소나 · 유스케이스
## 기능 요구사항 (FR)
- FR-1: ...

## 비기능 요구사항 (NFR)
- NFR-1 (성능): ...
- NFR-2 (보안): ...
- NFR-3 (접근성): ...

## 성공 지표
| 지표 | 기준 | 측정 방법 |

## 범위 / 범위 밖
## 위험 및 가정
## 오픈 이슈
## 반대 의견 보존
```

### 3. `/sdlc:architecture <name>`

**역할**: PRD를 입력으로 아키텍처 문서를 생성하고, 해당 스택의 **팀 표준 문서를 "Applicable Standards"로 링크**한다.

- **주도 페르소나**: `architect` (+ `backend`, `frontend`, `dba`, `security`, `cloud` 등 주제별)
- **입력**: `${CLAUDE_PROJECT_DIR}/docs/prd/prd-<name>.md` (필수)
- **출력**: `${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-<name>.md`
- **인자**: 이름 생략 시 Current Feature 사용.
- **동작**:
  1. PRD에서 스택 키워드 추출 (Spring Boot / Next.js / FastAPI / ...)
  2. `docs/standards/<stack>/` 파일들을 참조로 링크 (복사 X)
  3. architect 주도로 컴포넌트·데이터 모델·API 계약·보안·성능 논의

**필수 섹션**:
```markdown
# Architecture: <제목>

- **식별자**: <name>
- **작성일**: YYYY-MM-DD
- **참조 PRD**: docs/prd/prd-<name>.md
- **기술 스택**: <감지된 스택>
- **상태**: draft | approved

## 컨텍스트
(텍스트 다이어그램 또는 Mermaid)

## 컴포넌트
## 데이터 모델
## API 계약 개요
## 스택 선택 근거
## 적용되는 표준 (Applicable Standards)
- [docs/standards/backend/springboot/api.md](../standards/backend/springboot/api.md)
- [docs/standards/backend/springboot/security.md](../standards/backend/springboot/security.md)
- ...

## 보안 / 성능 / 관찰성
## 대안 및 폐기 결정
## 오픈 이슈
```

### 4. `/sdlc:plan [name|prd-path arch-path out-path]`

세 가지 호출 형식 지원:
- **0 인자**: Current Feature 에서 이름 resolve → `docs/prd/prd-<name>.md` + `docs/architecture/architecture-<name>.md` → `docs/plans/plan-<name>.md`
- **1 인자**: kebab-case 이름으로 같은 방식 resolve
- **3 인자**: 명시 경로 (레거시 호환)

산출물: `docs/plans/plan-<name>.md` + `docs/plans/plan-<name>.deps.md`

### 5. `/sdlc:story start|verify|complete` (기존)

Plan 경로 또는 feature 이름을 인자로 받되 둘 다 생략 시 Current Feature 사용. `start` 단계는 `docs/prd/prd-<name>.md` 와 `docs/architecture/architecture-<name>.md` 를 참조로 자동 로드한다.

### 6. E2E 테스트

**별도 커맨드 없음**. `/sdlc:story verify`·`/sdlc:story complete`가 AC·DoD 검증 시점에 사용자 프로젝트의 테스트 스택을 자동 감지해 실행하는 기존 동작을 유지한다. 자동화 한계가 있으므로, 수동 테스트 체크리스트는 Story의 DoD 섹션에 포함한다.

---

## Handoff 계약

| 단계 | 소비 입력 | 생산 출력 | 사전조건 미충족 시 |
|---|---|---|---|
| `/sdlc:feature` | 사용자 대화 | `docs/features/feature-<name>.md` + CLAUDE.md current 갱신 | — |
| `/sdlc:prd` | `docs/features/feature-<name>.md` | `docs/prd/prd-<name>.md` | `/sdlc:feature <name>` 안내 후 종료 |
| `/sdlc:architecture` | `docs/prd/prd-<name>.md` | `docs/architecture/architecture-<name>.md` | `/sdlc:prd <name>` 안내 후 종료 |
| `/sdlc:plan` | PRD + Architecture | `docs/plans/plan-<name>.md` + `plan-<name>.deps.md` | PRD·arch 누락 시 안내 |
| `/sdlc:story` | Plan + Story ID | 코드·브랜치 + Plan 업데이트 | Plan 누락 시 안내 |

**원칙**: 자동 체인 실행은 지원하지 않는다. 각 단계는 사용자가 명시 호출한다 (승인 지점 보존).

---

## Current Feature 메커니즘

### 등록
`/sdlc:feature <name>` 이 성공하면 `${CLAUDE_PROJECT_DIR}/CLAUDE.md` 에 아래 섹션을 upsert 한다 (기존 섹션이 있으면 교체):

```markdown
## Current Feature
- **이름**: <name>
- **최종 갱신**: YYYY-MM-DD
```

### 조회 (resolver)
이름 인자를 받는 모든 후속 커맨드는 다음 알고리즘을 사용한다:

1. `$1` 이 주어졌고 파일 경로 형태면 → 그대로 사용 (레거시 호환)
2. `$1` 이 주어졌고 kebab-case 이름이면 → `docs/<type>/<type>-$1.md` 로 resolve
3. `$1` 이 비어있으면 → CLAUDE.md 의 Current Feature 에서 이름 추출 → 2번과 동일하게 resolve
4. 셋 다 실패하면 친절한 에러 + `/sdlc:feature <이름>` 실행 안내

### 적용 커맨드
- `/sdlc:prd [name]`
- `/sdlc:architecture [name]`
- `/sdlc:plan [name]` (또는 레거시 3-경로 모드)
- `/sdlc:story <step> <StoryID> [name|path]`
- `/sdlc:pr <StoryID> [name|path]`
- `/sdlc:plan-review [name|path]`
- `/sdlc:scope-change [name|path] [사유]`
- `/sdlc:status [name|path]`

### Feature 전환
다른 feature 로 전환하려면 `/sdlc:feature <다른이름>` 을 재호출하면 된다 — Current Feature 가 덮어써진다.

---

## 기존 커맨드와의 관계

- **`/sdlc:meeting`**: 범용 미팅 커맨드로 위치 재정의. feature/PRD/architecture가 아닌 임의 토픽 토론(예: 운영 이슈, 스코프 논의)에 사용. `docs/meetings/meeting-<구분>-...md`에 계속 기록.
- **`/sdlc:plan-review`, `/sdlc:scope-change`, `/sdlc:status`**: 모두 Current Feature resolver 를 사용한다.
- 스코프 변경 후엔 `/sdlc:plan` 을 재실행해 Plan 을 갱신한다.

---

## 디렉토리 구조 (업데이트)

```
${CLAUDE_PROJECT_DIR}/docs/
├── features/           # NEW — /sdlc:feature 산출물 (경량 요구사항)
├── prd/                # /sdlc:prd 산출물 (공식 PRD)
├── architecture/       # /sdlc:architecture 산출물
├── plans/              # /sdlc:plan 산출물
├── meetings/           # /sdlc:meeting 산출물 (범용)
├── retrospectives/
├── standups/           # (gitignore)
├── pr-drafts/          # (gitignore)
├── onboarding/         # (gitignore)
├── guides/
└── standards/          # 27개 팀 표준 (init에서 설치)
```

`/sdlc:init`는 `docs/features/` 디렉토리를 함께 생성하도록 갱신한다.

---

## 마이그레이션 가이드

기존 `/sdlc:meeting`만 사용해온 사용자를 위한 전환 가이드:

| 기존 사용 패턴 | 권장 전환 |
|---|---|
| `/sdlc:meeting pm, ux \| 새 기능 요구사항 수집` | `/sdlc:feature <name>` |
| `/sdlc:meeting pm, architect \| PRD 작성` | `/sdlc:prd <name>` (feature.md 선행) |
| `/sdlc:meeting architect, backend \| 아키텍처 논의` | `/sdlc:architecture <name>` (PRD 선행) |
| 그 외 임의 토픽 | `/sdlc:meeting` 계속 사용 |

기존에 작성된 `docs/meetings/` 산출물은 그대로 보존된다 (마이그레이션 불필요).

---

## 검증 시나리오

빈 테스트 레포에서:

1. `/sdlc:init` → `docs/features/`, `docs/prd/`, `docs/architecture/` 생성 확인
2. `/sdlc:feature login-mfa` → `docs/features/feature-login-mfa.md` 생성 + CLAUDE.md 에 Current Feature: login-mfa 등록
3. `/sdlc:prd` (인자 없음) → `docs/prd/prd-login-mfa.md` 생성 (current 사용)
4. `rm docs/features/feature-x.md && /sdlc:prd x` → 친절한 에러 + `/sdlc:feature x` 안내
5. `/sdlc:architecture` → `docs/architecture/architecture-login-mfa.md` 생성 + Applicable Standards 링크 포함
6. `/sdlc:plan` (인자 없음) → `docs/plans/plan-login-mfa.md` + `.deps.md` 생성
7. `/sdlc:story start E1-S1` → Current Feature 의 plan 을 읽어 킥오프
8. `/sdlc:feature other-thing` 재호출 후 `/sdlc:prd` → 자동으로 `other-thing` 대상 실행

---

## 버전 영향

- 신규 커맨드 3개 추가 (`feature`, `prd`, `architecture`)
- **파일명 규약 변경**: `docs/<type>/<name>.md` → `docs/<type>/<type>-<name>.md` (breaking for existing projects — 마이그레이션: rename 또는 재생성)
- **Current Feature 메커니즘**: `/sdlc:feature` 가 CLAUDE.md 에 등록, 후속 커맨드 다수가 이름 인자 생략 가능
- `plan`, `story`, `pr`, `plan-review`, `scope-change`, `status` 가 Current Feature resolver 채택
- 템플릿 샘플 rename: `templates/docs/prd/email-verification.md` → `templates/docs/prd/prd-email-verification.md` (architecture 동일)
- **semver**: minor bump → **v1.0.2 → v1.1.0**
- `plugin.json`과 `.claude-plugin/marketplace.json` 동시 bump (CLAUDE.md 규약)
