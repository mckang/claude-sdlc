---
argument-hint: [PRD경로] [아키텍처경로] [산출물경로]
description: PRD와 아키텍처 문서를 읽고 Epic→Story→Task 분해 계획을 생성
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 실행 계획 생성 명령

사용자가 `/plan <PRD경로> <아키텍처경로> <산출물경로>` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/plan ${CLAUDE_PROJECT_DIR}/docs/prd/checkout-v2.md ${CLAUDE_PROJECT_DIR}/docs/architecture/checkout-v2.md ${CLAUDE_PROJECT_DIR}/docs/plans/checkout-v2.md
```

## 1단계: 인자 파싱 및 검증

공백으로 분리된 3개 경로를 파싱:
- `$1`: PRD 문서 경로
- `$2`: 아키텍처 문서 경로
- `$3`: 산출물(Plan) 저장 경로

인자가 부족하거나 경로가 틀렸다면 즉시 멈추고 올바른 호출법 안내:

```
올바른 호출법:
/plan ${CLAUDE_PROJECT_DIR}/docs/prd/<feature>.md ${CLAUDE_PROJECT_DIR}/docs/architecture/<feature>.md ${CLAUDE_PROJECT_DIR}/docs/plans/<feature>.md
```

### 입력 파일 존재 확인
```bash
test -f "$1" && test -f "$2" || echo "파일 누락"
```

둘 중 하나라도 없으면 중단하고 사용자에게 보고.

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
- DB 스키마 변경 있으면 → `dba`
- 테스트 전략 필요하면 → `qa`
- 보안 결정 포함되면 → `security`
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

**참여**: scrum-master (주도), architect, backend/frontend/dba/qa (주제별)

**목표**: 각 Epic을 **수직 슬라이스 Story**로 분해

Scrum Master가 각 Epic을 3-7개 Story로 쪼개고, 각 Story마다:
- **ID**: E1-S1 형식
- **제목**: 동사로 시작, 사용자 관점
- **설명**: 1-2문장
- **수용 기준 (AC)**: 2-5개, Given-When-Then
- **T-shirt size**: S/M/L/XL
- **담당 영역**: backend / frontend / dba / mobile / mixed

구현 페르소나가 공수·실현 가능성 검증 ("이거 L이다", "XL인데 쪼개야 한다").

XL 나오면 즉시 재분해.

### Round 3: Task 분해

각 Story를 2-5개 Task로 분해.

Task 형식:
- **ID**: E1-S1-T1
- **제목**: 구체적 작업 (코드·DB·설정·테스트)
- **담당**: backend / frontend / dba / qa
- **T-shirt size**: S/M (대부분 S-M, L 이상은 Story로 쪼개야 신호)

Task 예:
```
E1-S1-T1: users 테이블 마이그레이션 작성 (dba, S)
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

각 전문가가 자기 영역의 숨은 의존성·리스크 제기 (예: Security가 "인증 통합 전에 보안 리뷰 필요", DBA가 "이 마이그레이션은 온라인으로 안 됨, 다운타임 필요").

## 6단계: 산출물 작성

두 개의 파일을 생성한다:

### 6.1 메인 계획 문서 (`$3`)

```markdown
# 실행 계획: {제목}

- **작성일**: YYYY-MM-DD
- **참조 PRD**: {$1}
- **참조 아키텍처**: {$2}
- **기술 스택**: {감지된 스택}
- **상태**: draft | approved | in_progress | done

## 요약
- Epic: N개
- Story: M개
- Task: K개
- 예상 기간: N주 (버퍼 포함)
- 마일스톤: M개

## 마일스톤
| ID | 이름 | 목표일 (주차) | 기준 |
|----|------|---------------|------|
| M1 | ... | 주 2 | 스테이징 배포 |
| M2 | ... | 주 5 | 베타 오픈 |
| ... |

## Epic·Story·Task 분해

### E1: {Epic 이름}
**목표**: {한 문장 요약}
**예상 크기**: S/M/L/XL 합산
**마일스톤**: M1

#### E1-S1: {Story 제목}
- **담당 영역**: backend, dba
- **크기**: M
- **설명**: ...
- **수용 기준**:
  - AC-1: Given ~ When ~ Then ~
  - AC-2: ...
- **DoD**:
  - [ ] 단위 테스트 통과
  - [ ] 코드 리뷰 통과
  - [ ] 스테이징 배포 확인
  - [ ] (Story별 추가 기준)

**Task**:
| ID | 제목 | 담당 | 크기 |
|----|------|------|------|
| E1-S1-T1 | users 테이블 마이그레이션 | dba | S |
| E1-S1-T2 | POST /api/v1/auth/signup | backend | M |
| ... |

#### E1-S2: ...

### E2: ...

## 크리티컬 패스
(텍스트 설명, 의존성 다이어그램은 별도 파일 참조)

E1-S1 (DB) → E1-S3 (Auth API) → E1-S5 (Login UI) → E2-S1 (상품 조회) → ...

## 리스크 및 완화

| ID | 등급 | 내용 | 완화 전략 | 담당 |
|----|------|------|-----------|------|
| R1 | 🔴 | OAuth 제공자 정책 변경 | 두 번째 제공자 Fallback 설계 | security |
| R2 | 🟡 | 기존 DB 마이그레이션 락 | 온라인 마이그레이션 POC 선행 | dba |
| ... |

## 가정 및 미결 사항
- ...

## 반대 의견 보존
(회의 중 채택되지 않은 의견 — 나중 재검토용)

## 회의 로그
(전체 회의 대화 발언 순서·헤더 보존하며 append)
```

### 6.2 의존성 다이어그램 파일 (`$3.deps.md` 또는 `<plan>.deps.md`)

산출물 경로 `$3` 가 `${CLAUDE_PROJECT_DIR}/docs/plans/checkout-v2.md`라면, 의존성 파일은 `${CLAUDE_PROJECT_DIR}/docs/plans/checkout-v2.deps.md`:

```markdown
# 의존성 그래프: {제목}

메인 계획: [{$3 파일명}]({$3 상대경로})

## Story 간 의존성

\`\`\`mermaid
graph LR
  E1S1[E1-S1: DB 스키마] --> E1S2[E1-S2: 사용자 API]
  E1S1 --> E1S3[E1-S3: 인증 API]
  E1S2 --> E1S4[E1-S4: 프로필 UI]
  E1S3 --> E1S5[E1-S5: 로그인 UI]
  E1S5 --> E2S1[E2-S1: 대시보드]
  E1S4 --> E2S1
  
  classDef critical fill:#fee,stroke:#c00,stroke-width:3px
  classDef done fill:#efe,stroke:#0a0
  class E1S1,E1S3,E1S5,E2S1 critical
\`\`\`

### 범례
- 🔴 빨간 테두리: 크리티컬 패스 (지연 허용 없음)
- 실선 화살표: 하드 블로킹 (A 없이 B 불가)
- 점선 화살표: 소프트 의존 (Mock 등으로 우회 가능)

## 병렬화 트랙

트랙 A (Backend/DB): E1-S1 → E1-S3 → E2-S2 → ...
트랙 B (Frontend): E1-S4 → E1-S5 → E2-S1 → ...
트랙 C (QA/통합): 각 Story 완료 후 즉시

## 마일스톤별 완료 Story

- **M1 (주 2)**: E1-S1, E1-S2, E1-S3
- **M2 (주 5)**: E1-S4, E1-S5, E2-S1, E2-S2
- **M3 (주 8)**: E2-S3, E3-S1, E3-S2
- **M4 (주 11)**: 잔여 전부 + 버퍼

## 외부 의존성

프로젝트 외부의 의존 (3rd party API, 인프라 준비, 법무 검토 등):

\`\`\`mermaid
graph TD
  LEGAL[법무 검토: PG사 계약] --> E3S1
  INFRA[프로덕션 DB 증설] --> E1S1
  DESIGN[UX 디자인 시안] --> E1S5
\`\`\`
```

## 7단계: 최종 보고

```
✅ 실행 계획 생성 완료

입력:
- PRD: {$1}
- 아키텍처: {$2}

산출물:
- 계획: {$3}
- 의존성: {$3.deps.md}

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
