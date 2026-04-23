---
argument-hint: [feature 이름 (kebab-case, 생략 시 current feature 사용)]
description: feature 요구사항 문서를 입력으로 공식 PRD를 생성 (FR/NFR/성공지표 포함)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# PRD 생성 명령

사용자가 `/sdlc:prd [feature이름]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:prd                   # current feature 사용 (CLAUDE.md)
/sdlc:prd checkout-v2       # 명시적 이름
```

## 1단계: Feature 이름 확정

### 1-a. 인자로 지정된 경우
`$1` 이 있으면 그 값을 `NAME` 으로 사용.

### 1-b. 생략된 경우 — CLAUDE.md 에서 current feature 조회

```bash
NAME="$1"
if [ -z "$NAME" ]; then
  NAME=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-current-feature.sh")
  if [ -z "$NAME" ]; then
    cat <<'EOF'
❌ feature 이름이 지정되지 않았고, CLAUDE.md 에 Current Feature 도 없습니다.

다음 중 하나로 해결하세요:
  /sdlc:feature <이름>    # 새 feature 수집 + current 자동 등록
  /sdlc:prd <이름>        # 이름을 직접 지정
EOF
    exit 1
  fi
  echo "ℹ️  Current Feature 사용: $NAME"
fi
```

## 2단계: 사전조건 확인 — feature.md 존재

```bash
FEATURE="${CLAUDE_PROJECT_DIR}/docs/features/feature-$NAME.md"
test -f "$FEATURE" || { echo "❌ feature 문서를 찾을 수 없습니다: $FEATURE"; exit 1; }
```

없으면 안내 후 중단:
```
❌ feature 문서를 찾을 수 없습니다: docs/features/feature-<name>.md

먼저 실행해주세요:
  /sdlc:feature <name>
```

### 산출물 경로

```
OUT="${CLAUDE_PROJECT_DIR}/docs/prd/prd-$NAME.md"
```

상위 디렉터리 생성:
```bash
mkdir -p "${CLAUDE_PROJECT_DIR}/docs/prd"
```

### 기존 PRD 처리

PRD가 이미 존재하면:
```
docs/prd/prd-<name>.md 가 이미 존재합니다.
  1) 덮어쓰기 (기존은 prd-<name>-history.md 로 백업)
  2) 편집 모드 (기존 내용 보강)
  3) 취소
```

응답 대기. 취소면 종료.

## 3단계: feature.md 읽고 분석

`Read`로 `docs/features/feature-<name>.md` 전체 읽기. 다음을 추출:
- 제목·식별자
- 배경/문제
- 대상 사용자
- 해결하고 싶은 것
- 성공 기준 (초안)
- 범위 밖
- 제약/가정
- 오픈 이슈

누락된 섹션이 있으면 PRD 작성 중 사용자에게 추가 질의.

## 4단계: 참석자 선정 및 페르소나 로드

### 기본 참석자
- **`pm`** (주도)
- **`facilitator`** (진행자)

### 주제 기반 추가
feature.md 의 내용에서 다음을 감지해 참석자 추가:
- UI/UX·사용자 조사·문서 → `discovery`
- 백엔드·API 중심 → `techlead` + `backend`
- 데이터·분석·ML → `data`
- 보안·인증·개인정보·규제 → `compliance`
- 결제·과금·비용·운영 → `platform`

각 참석자의 `${CLAUDE_PLUGIN_ROOT}/agents/<이름>.md` 를 `Read` 로 로드.

### 프로젝트 오너 확인
`${CLAUDE_PROJECT_DIR}/CLAUDE.md` 의 "프로젝트 오너" 섹션 참조. 결정 필요 시 오너에게 질의.

## 5단계: 관련 표준 문서 로드 (선택)

`${CLAUDE_PROJECT_DIR}/docs/standards/` 에서 주제 관련 문서를 `Read`:
- 보안 요구사항 감지 → `security.md` (스택별)
- API 요구사항 감지 → `api.md` (스택별)
- 테스트 요구사항 감지 → `testing.md`

없으면 무시하고 진행 (`docs/standards/` 자체가 없어도 에러 금지).

## 6단계: PRD 도출 미팅 진행

메인 Claude 가 **진행자 + 각 참석자 역할**을 한 응답 안에서 수행. 사용자 의사결정이 필요한 순간만 멈춘다.

### 발화 형식
```
**[이모지] [이름] ([역할]):**
(2-5 문단)
```

### 진행 라운드

#### Round 1: 개요·동기 정렬
- PM 이 feature.md 요약 (3줄)
- 배경/동기를 더 깊이 탐구 — "왜 지금?", "왜 우리가?", "왜 이 방법?"

#### Round 2: 페르소나·유스케이스 구체화
- UX/PM 주도
- 1-3명의 사용자 페르소나 정의 (이름·역할·목적·좌절)
- 각 페르소나마다 2-3개 유스케이스

#### Round 3: FR/NFR 도출
- PM + 도메인 전문가
- **FR** (기능 요구사항): feature.md 의 "해결하고 싶은 것"을 FR-1, FR-2, ... 로 구체화 (각 FR 은 1문장·검증 가능)
- **NFR** (비기능): 성능, 보안, 접근성, 가용성, 호환성 중 관련 것만 포함. 숫자로 못 박음 ("응답 p95 < 200ms")

#### Round 3.5: 엣지 케이스 체크리스트 (필수 · AC 소급 추가 방지)

> **왜**: 성공 경로 AC 만 다루면 구현 중 "이 경우는 어떻게?" 가 뒤늦게 튀어나와 Story 가 깨진다. PRD 단계에서 아래 7개 축을 **각 FR 마다** 명시적으로 질의해 edge case 를 선제 수집한다. (`todo-app` feature 회고에서 AC 소급 추가 2건 발생 — 이 라운드가 없어서 발생한 손실)

각 FR 에 대해 다음 7개 축을 **한 줄 질문·한 줄 답변** 형식으로 검토:

| 축 | 질문 예시 | 산출 |
|---|---|---|
| **빈 상태** | 데이터 0건일 때 UI·동작은? | EC-1 |
| **단일 항목** | 1건만 있을 때 (페이지네이션·통계) | EC-2 |
| **초대량** | 수천·수만 건 누적 시 (성능·용량·정렬) | EC-3 |
| **경계값** | 최소·최대·길이·정밀도 (0자, 200자, 음수, 소수점) | EC-4 |
| **조건 결과 0건** | 필터·검색·정렬 후 0건일 때 | EC-5 |
| **실패 경로** | 네트워크 단절·스토리지 오염·외부 API 500 등 | EC-6 |
| **권한 실패** | 로그아웃·만료·권한 부족 상태에서 접근 | EC-7 |

해당 없는 축은 "N/A — 사유" 로 명시 (건너뛰지 말 것. 명시적 제외가 중요).

사용자 응답을 받지 못하면 추정하지 말고 "오픈 이슈" 로 남긴다.

#### Round 4: 성공 지표 확정
- Analyst (있으면) 주도, 없으면 PM
- 지표·기준·측정 방법을 표로 정리

#### Round 5: 범위·위험·오픈 이슈
- 범위 밖 명시
- 위험 (🔴/🟡/🟢) + 완화책
- feature.md 의 오픈 이슈를 PRD 오픈 이슈로 승격 + 새로 발견된 것 추가

### 상호작용 규칙
- 참석자는 **이전 발언 참조**하며 발언
- 한 번은 의도적 이견 (모두 찬성은 토론 아님)
- 사용자 결정이 필요하면 즉시 멈추고 질의

## 7단계: PRD 산출물 작성

아래 템플릿으로 `Write`:

```markdown
# PRD: {제목}

- **식별자**: <name>
- **작성일**: YYYY-MM-DD
- **참조 feature**: docs/features/feature-<name>.md
- **기여자**: {참석 페르소나 목록}
- **상태**: draft

## 개요
{2-4문장. 무엇을, 누구를 위해, 왜}

## 배경 / 동기
{feature.md 의 배경을 확장 — 사업·사용자·기술 관점}

## 페르소나 · 유스케이스

### 페르소나 1: {이름} ({역할})
- 목적: ...
- 좌절: ...
- 유스케이스:
  1. ...
  2. ...

### 페르소나 2: ...

## 기능 요구사항 (FR)

| ID | 요구사항 | 우선순위 | 수용 기준 (요약) |
|----|---------|---------|----------------|
| FR-1 | ... | Must | ... |
| FR-2 | ... | Should | ... |

## 비기능 요구사항 (NFR)

| ID | 카테고리 | 요구사항 | 측정 기준 |
|----|---------|---------|----------|
| NFR-1 | 성능 | 응답 지연 | p95 < 200ms |
| NFR-2 | 보안 | 인증 | OAuth 2.1 + PKCE |
| NFR-3 | 접근성 | ... | WCAG 2.2 AA |

## 엣지 케이스 (Edge Cases)

Round 3.5 에서 수집한 edge case. 각 항목은 Plan 의 Story AC 로 승격된다.

| ID | 관련 FR | 축 | 상황 | 기대 동작 |
|----|---------|----|------|----------|
| EC-1 | FR-1 | 빈 상태 | 데이터 0건 | 안내 문구 + 입력 유도 |
| EC-2 | FR-2 | 조건 결과 0건 | 필터 후 0건 | "해당 없음" 안내 + 필터 해제 제안 |
| EC-3 | FR-3 | 경계값 | 입력 200자 초과 | 200자에서 잘림 + 입력창 피드백 |
| ... | ... | ... | ... | ... |

> 각 축(빈 상태·단일 항목·초대량·경계값·조건 결과 0건·실패 경로·권한 실패) 을 **모든 FR 에 걸쳐** 검토한다. 해당 없으면 "N/A — 사유" 로 명시.

## 성공 지표

| 지표 | 기준 | 측정 방법 | 측정 시점 |
|------|------|----------|----------|
| ... | ... | ... | 출시 후 4주 |

## 범위

### 포함
- ...

### 범위 밖
- ...

## 위험 및 완화

| ID | 등급 | 위험 | 완화 전략 | 담당 |
|----|------|------|----------|------|
| R1 | 🔴 | ... | ... | ... |

## 가정
- ...

## 오픈 이슈
- [ ] ...

## 반대 의견 보존
{회의 중 채택 안 된 의견 — 재검토용}

## 회의 로그
{전체 대화를 발언 헤더·순서 보존해 append}

## 다음 단계
- [ ] 아키텍처 설계: `/sdlc:architecture` (current feature 사용)
```

## 8단계: 최종 보고

```
✅ PRD 생성 완료

Feature: {제목}
식별자: <name>
입력: docs/features/feature-<name>.md
산출물: docs/prd/prd-<name>.md

요약:
- FR N개, NFR M개
- 성공 지표 K개
- 위험: 🔴 N건 / 🟡 M건 / 🟢 K건
- 오픈 이슈: N건

다음 단계:
  /sdlc:architecture         — current feature 이어받아 아키텍처 설계
```

## 주의사항

- feature.md 에 없던 내용은 회의 중 사용자에게 확인받아 추가 (추정 금지).
- 측정 불가능한 성공 지표는 받지 말 것 — 측정 방법이 없으면 오픈 이슈로.
- NFR 에서 숫자 기준을 못 박기 어려우면 "TBD — 벤치 필요" 로 남기고 오픈 이슈 추가.
- 기존 PRD 를 갱신하는 경우엔 반드시 `prd-<name>-history.md` 로 백업하고, 주요 변경점을 `## 변경 이력` 섹션에 기록.
- 산출물 최상단 "식별자" 는 `<name>` 과 정확히 일치 (후속 `/sdlc:architecture` 가 resolve).
- 회의 전체를 한 응답에서 끝내되, 사용자 결정 필요 지점에선 멈추고 대기.
