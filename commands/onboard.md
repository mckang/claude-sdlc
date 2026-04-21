---
argument-hint: [--role=backend|frontend|fullstack|any] [--feature=<이름>]
description: 새 팀원용 프로젝트 맥락 요약 (PRD·아키텍처·Plan·표준·최근 회고 통합)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 팀원 온보딩 요약

사용자가 `/onboard [--role=...] [--feature=...]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/onboard                                    # 전체 프로젝트 일반 요약
/onboard --role=backend                     # 백엔드 개발자용
/onboard --feature=email-verification       # 특정 기능만
/onboard --role=frontend --feature=checkout # 조합
```

## 1단계: 인자 파싱

- `--role=` (선택): `backend`, `frontend`, `fullstack`, `dba`, `qa`, `any` (기본)
- `--feature=` (선택): 특정 기능 이름 (PRD/Plan 파일명 prefix 기준)

## 2단계: 자료 스캔

다음 디렉터리를 `Glob`으로 전체 파악:

```bash
ls ${CLAUDE_PROJECT_DIR}/docs/prd/*.md 2>/dev/null
ls ${CLAUDE_PROJECT_DIR}/docs/architecture/*.md 2>/dev/null  
ls ${CLAUDE_PROJECT_DIR}/docs/plans/*.md 2>/dev/null
ls ${CLAUDE_PROJECT_DIR}/docs/retrospectives/*.md 2>/dev/null
ls ${CLAUDE_PROJECT_DIR}/docs/meetings/*.md 2>/dev/null | tail -10    # 최근 미팅 10개
ls ${CLAUDE_PROJECT_DIR}/docs/standards/ 2>/dev/null                  # 표준 디렉터리 구조
ls ${CLAUDE_PROJECT_DIR}/docs/standups/*.md 2>/dev/null | tail -3     # 최근 스탠드업 3개 (있으면)
```

`--feature` 지정 시 해당 prefix만 필터.

## 3단계: 각 문서 요약 추출

### PRD (1-2개 최신)

각 PRD 파일 `Read` 해서 다음 추출:
- 제목
- 배경 (1-2줄)
- 목표 및 성공 지표 (측정 가능한 것만)
- 주요 기능 요구사항 (FR) 상위 5개
- 범위 외 (Out of Scope)

### 아키텍처

- 기술 스택 표
- 시스템 구조 다이어그램 (mermaid 원본 보존 — 온보딩 문서에 그대로)
- 주요 API 엔드포인트 (최대 10개)
- 데이터 모델 핵심 테이블

### Plan

- Epic 목록과 각 상태 (진행률 %)
- 현재 진행 중인 Story
- 크리티컬 패스
- 마일스톤
- 알려진 리스크

### 표준

- 관련 표준 디렉터리 구조만 제시
- `--role=backend` 면 해당 스택의 5개 축 파일 경로만 나열
- 본문 포함하지 않음 (읽기 권장만)

### 최근 회고 (있으면 2개)

- 최근 2개 회고 파일에서 "Try" 및 "액션 아이템" 추출
- **아직 미완료된 액션**만 표시

### 최근 미팅 (상위 5개)

- 파일명 + 1줄 요약 (첫 제목)

## 4단계: 역할별 강조

`--role=` 에 따라 내용 조정:

### `backend`
- 아키텍처의 **백엔드 섹션** 강조
- `${CLAUDE_PROJECT_DIR}/docs/standards/backend/<감지된 스택>/` 경로 명시
- Plan에서 `backend` 담당 Story 하이라이트
- DB 관련 정보 포함

### `frontend`
- 아키텍처의 **프론트엔드 섹션** 강조
- `${CLAUDE_PROJECT_DIR}/docs/standards/frontend/` 경로
- Plan에서 `frontend` 담당 Story 하이라이트
- UX 관련 고려사항

### `dba`
- 데이터 모델·인덱스 전략
- `${CLAUDE_PROJECT_DIR}/docs/standards/database/` 전부
- 마이그레이션 기록

### `qa`
- `${CLAUDE_PROJECT_DIR}/docs/standards/<스택>/testing.md`
- Plan의 AC·DoD 규칙
- 알려진 버그·이슈

### `fullstack` / `any`
- 모든 영역 균형 있게

## 5단계: 온보딩 문서 생성

다음 형식으로 **한 개의 Markdown 문서** 출력:

```markdown
# 🚀 온보딩: {프로젝트명 또는 '프로젝트 전반'}

- **생성일**: 2026-04-21
- **대상 역할**: backend (또는 any)
- **특정 기능**: email-verification (또는 생략)

## 👋 들어가며

이 문서는 프로젝트에 합류한 팀원이 **30분 안에** 핵심을 파악하도록 만든 요약입니다.
필요한 부분은 원본 문서(링크)로 바로 이동할 수 있습니다.

---

## 1️⃣ 프로젝트 개요

### 배경
(PRD 첫 문단에서 추출)

### 목표
- 주 지표: ...
- 부 지표: ...

### 비즈니스 가치
(왜 이걸 만드는가)

**더 읽기**: [${CLAUDE_PROJECT_DIR}/docs/prd/prd-email-verification.md](${CLAUDE_PROJECT_DIR}/docs/prd/prd-email-verification.md)

---

## 2️⃣ 시스템 구조

### 기술 스택

| 영역 | 선택 | 이유 |
|------|------|------|
| 백엔드 | Spring Boot 3.x / Java 21 | 기존 스택 |
| DB | PostgreSQL 16 | ... |
| ...

### 구조 다이어그램

```mermaid
(아키텍처 문서의 mermaid 그대로)
```

### 주요 API 엔드포인트

- `POST /api/v1/auth/verification/send` — 인증 메일 재전송
- `POST /api/v1/auth/verification/verify` — 토큰 검증
- `GET /api/v1/admin/users/unverified` — 관리자용 목록

**더 읽기**: [${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-email-verification.md](${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-email-verification.md)

---

## 3️⃣ 현재 진행 상황

### Plan 개요

- 총 Epic: 5개
- 총 Story: 18개 (완료 8 / 진행 3 / 블로킹 1 / 예정 6)
- 진행률: 44% (크기 가중 46%)
- 예상 완료: M4 마일스톤 (주 11)

### 현재 진행 중인 Story

- 🔄 **E2-S1**: SES 메일 발송 통합 (backend)
- 🔄 **E1-S3**: 재전송 API + Rate limit (backend)

### 크리티컬 패스

E1-S1 ✅ → E1-S3 🔄 → E2-S1 🔄 → E2-S2 → E3-S1

### 현재 블로커

- ⚠️ E2-S1-T3: AWS SES 프로덕션 승인 대기 (크리티컬 패스 위)

**더 읽기**:
- Plan: [${CLAUDE_PROJECT_DIR}/docs/plans/plan-email-verification.md](${CLAUDE_PROJECT_DIR}/docs/plans/plan-email-verification.md)
- 의존성 그래프: [${CLAUDE_PROJECT_DIR}/docs/plans/plan-email-verification.deps.md](${CLAUDE_PROJECT_DIR}/docs/plans/plan-email-verification.deps.md)
- 최신 상태: `/status ${CLAUDE_PROJECT_DIR}/docs/plans/plan-email-verification.md`

---

## 4️⃣ 당신의 역할: {role}

{role 에 맞는 내용}

### 당신이 주로 볼 문서

**팀 표준** (필독):
- [${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/api.md](${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/api.md) — API 설계
- [${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/structure.md](${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/structure.md) — 프로젝트 구조
- [${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/testing.md](${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/testing.md) — 테스트
- [${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/security.md](${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/security.md) — 보안
- [${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/observability.md](${CLAUDE_PROJECT_DIR}/docs/standards/backend/springboot/observability.md) — 로깅·메트릭

### 당신이 착수 가능한 Story

(Plan에서 role 담당 & 선행 의존성 완료된 것)

- **E2-S2**: 가입 시 자동 발송 훅 (backend, M) — 즉시 착수 가능
- **E3-S1**: 관리자 API (backend, L) — E2-S1 완료 대기

---

## 5️⃣ 팀 문화·프로세스

### 개발 사이클

Story 단위로 진행: `/story start <ID> <Plan>` → 구현 → `/story verify` → `/story complete` → `/pr`

**더 읽기**: [${CLAUDE_PROJECT_DIR}/docs/guides/development-workflow.md](${CLAUDE_PROJECT_DIR}/docs/guides/development-workflow.md)

### 커밋·PR 규칙

- Conventional Commits (`feat`, `fix`, `refactor` 등)
- Story 단위 PR
- 본문에 Story ID·AC 필수

### 코드 리뷰 기준

- `${CLAUDE_PROJECT_DIR}/docs/standards/` 의 금지 사항 점검
- AC 자동 테스트 커버 여부
- 보안 체크리스트

---

## 6️⃣ 최근 학습 사항 (이전 회고에서)

다음은 과거 프로젝트의 교훈으로, 현재도 지켜야 할 **액션 아이템**들입니다:

(최근 회고 파일들의 "액션 아이템" 에서 미완료만)

- **[A2]** 외부 의존성은 kickoff 1주 내 확인 체크리스트 사용 (담당: techlead)
  - 출처: [${CLAUDE_PROJECT_DIR}/docs/retrospectives/checkout-v2.md](${CLAUDE_PROJECT_DIR}/docs/retrospectives/checkout-v2.md)
- **[A3]** XL 쪼갠 후 재추정 규칙 적용 (담당: scrum-master)
  - 출처: [${CLAUDE_PROJECT_DIR}/docs/retrospectives/feature-x.md](${CLAUDE_PROJECT_DIR}/docs/retrospectives/feature-x.md)

---

## 7️⃣ 유용한 명령어

```
# 현재 상태 빠르게 파악
/status ${CLAUDE_PROJECT_DIR}/docs/plans/plan-email-verification.md

# Story 착수
/story start E2-S2 ${CLAUDE_PROJECT_DIR}/docs/plans/plan-email-verification.md

# 기술 결정 회의
/meeting backend, security, dba | <주제> | ${CLAUDE_PROJECT_DIR}/docs/meetings/<이름>.md

# PR 본문 자동 생성
/pr E2-S2 ${CLAUDE_PROJECT_DIR}/docs/plans/plan-email-verification.md

# 오늘 스탠드업
/standup ${CLAUDE_PROJECT_DIR}/docs/plans/plan-email-verification.md
```

---

## 8️⃣ 최근 미팅 이력 (참고)

가장 최근 결정·논의 5건:

- [${CLAUDE_PROJECT_DIR}/docs/meetings/session-store.md](${CLAUDE_PROJECT_DIR}/docs/meetings/session-store.md) — 세션 저장소 Redis 선택
- [${CLAUDE_PROJECT_DIR}/docs/meetings/rate-limit-strategy.md](${CLAUDE_PROJECT_DIR}/docs/meetings/rate-limit-strategy.md) — Bucket4j 도입
- ...

---

## 9️⃣ 막히면?

- **기술 질문**: `/meeting <관련 페르소나> | <주제> | ${CLAUDE_PROJECT_DIR}/docs/meetings/<이름>.md`
- **Plan 이해 안 감**: `${CLAUDE_PROJECT_DIR}/docs/plans/*.deps.md` 의존성 그래프 확인
- **표준 충돌**: 해당 `.md` 의 "금지 사항"과 본인 상황 비교, 필요시 팀에 예외 문의

## 🔟 첫 주 제안 로드맵

- **Day 1**: 이 온보딩 문서 + PRD·아키텍처 원본 읽기 (2-3시간)
- **Day 2**: 해당 영역 표준 문서 5개 읽기
- **Day 3-5**: S 크기 Story 하나 담당 (진짜 작업)
- **Week 2**: 첫 PR 머지, M 크기 Story 진입
```

## 6단계: 저장 및 보고

`${CLAUDE_PROJECT_DIR}/docs/onboarding/<YYYY-MM-DD>.md` 또는 role·feature 기반 이름으로 저장:
- `${CLAUDE_PROJECT_DIR}/docs/onboarding/backend-2026-04-21.md`
- `${CLAUDE_PROJECT_DIR}/docs/onboarding/email-verification-backend.md` (조합)

보고:
```
✅ 온보딩 문서 생성 완료

산출물: ${CLAUDE_PROJECT_DIR}/docs/onboarding/backend-email-verification.md
대상: backend 역할 / email-verification 기능

포함:
- PRD 요약 (배경·목표·핵심 FR)
- 아키텍처 다이어그램 + 기술 스택
- 현재 Plan 진행 상황 (44%, 블로커 1건)
- backend 역할 맞춤: 담당 가능 Story 2개
- 표준 문서 링크 5개
- 최근 회고 미완 액션 2건
- 유용한 명령어·로드맵

권장: 새 팀원이 2-3시간 안에 통독 + 원본 문서로 깊게 읽기
```

## 주의사항

- **원본 문서를 대체하지 않음** — 요약·길잡이 역할. 원본 링크 필수.
- **자동 감지가 불완전**할 수 있음 — 사용자에게 생성 후 검토 요청
- **회고의 미완 액션**은 진짜 개선 포인트 — 꼭 포함
- 너무 길어지면 읽지 않음 → 섹션당 **5줄 이내** 요약 지향
- PRD·Plan이 여러 개면 최신 또는 `--feature`로 지정된 것만

## 에러 처리

- `${CLAUDE_PROJECT_DIR}/docs/prd/` 없음 → 경고 후 아키텍처·Plan 기반으로 진행
- `${CLAUDE_PROJECT_DIR}/docs/plans/` 비어있음 → "Plan이 없습니다. /plan 먼저 실행" 안내
- `--feature=` 지정했는데 해당 파일 없음 → 사용 가능한 feature 목록 제시

## 팁

- 월 1회 갱신 권장 (프로젝트 진행 따라 내용 변동)
- 온보딩 문서 자체를 슬랙·위키에 공유
- 신규 입사자 1:1 미팅 준비 자료로 활용
