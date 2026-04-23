---
argument-hint: [feature 이름 (kebab-case, 생략 시 current feature 사용)]
description: PRD를 입력으로 아키텍처 문서를 생성하고 팀 표준을 링크 — architect/backend/frontend/data 협의
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 아키텍처 설계 명령

사용자가 `/sdlc:architecture [feature이름]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:architecture                  # current feature 사용
/sdlc:architecture checkout-v2      # 명시적 이름
```

## 1단계: Feature 이름 확정

```bash
NAME="$1"
if [ -z "$NAME" ]; then
  NAME=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-current-feature.sh")
  if [ -z "$NAME" ]; then
    cat <<'EOF'
❌ feature 이름이 지정되지 않았고, CLAUDE.md 에 Current Feature 도 없습니다.

다음 중 하나로 해결하세요:
  /sdlc:feature <이름>          # feature 부터 시작 (current 자동 등록)
  /sdlc:architecture <이름>     # 이름을 직접 지정
EOF
    exit 1
  fi
  echo "ℹ️  Current Feature 사용: $NAME"
fi
```

## 2단계: 사전조건 확인 — PRD 존재

```bash
PRD="${CLAUDE_PROJECT_DIR}/docs/prd/prd-$NAME.md"
test -f "$PRD" || { echo "❌ PRD 문서가 없습니다: $PRD"; exit 1; }
```

없으면 안내 후 중단:
```
❌ PRD 를 찾을 수 없습니다: docs/prd/prd-<name>.md

먼저 실행해주세요:
  /sdlc:prd <name>
```

### 산출물 경로

```
OUT="${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-$NAME.md"
```

상위 디렉터리 생성:
```bash
mkdir -p "${CLAUDE_PROJECT_DIR}/docs/architecture"
```

### 기존 아키텍처 처리

기존 파일이 있으면:
```
docs/architecture/architecture-<name>.md 가 이미 존재합니다.
  1) 덮어쓰기 (기존은 architecture-<name>-history.md 로 백업)
  2) 편집 모드 (기존 내용 보강 — 변경점은 ## 변경 이력 섹션에 기록)
  3) 취소
```

## 3단계: PRD 읽고 분석

`Read`로 PRD 읽고 다음을 추출:
- 기능 요구사항 (FR)
- 비기능 요구사항 (NFR) — 특히 성능·보안·가용성 기준
- 페르소나·유스케이스 (데이터 흐름 단서)
- 위험
- 범위 밖

PRD 에 아키텍처 힌트가 있으면 활용 (예: "REST + Postgres", "React SPA").

## 4단계: 기술 스택 감지

PRD 본문에서 다음 키워드를 감지해 스택을 판별:

| 키워드 | 감지 스택 |
|-------|----------|
| Spring, Java, JPA, Kotlin | `backend/springboot` |
| Next.js, Node, TypeScript, React | `backend/nextjs-typescript` + `frontend` |
| FastAPI, Python, Pydantic | `backend/fastapi` |
| iOS, Android, Flutter, React Native | `techlead` (Mobile 모자) + `frontend` |
| Postgres, MySQL, 스키마, 마이그레이션 | `database` |

**스택이 모호하면** 사용자에게 질의:
```
PRD에서 기술 스택을 명확히 감지하지 못했습니다.
후보: [Spring Boot, Next.js, FastAPI, 기타]
이번 feature의 주 스택을 알려주세요:
```

응답 대기. `기타` 면 자유 입력 후 `standards` 링크 없이 진행.

## 5단계: 팀 표준 문서 로드 및 참조 준비

감지된 스택에 대해 `${CLAUDE_PROJECT_DIR}/docs/standards/` 하위 파일들을 `Glob`으로 찾고 `Read`로 일부 로드:

```
backend:
- docs/standards/backend/<stack>/api.md
- docs/standards/backend/<stack>/structure.md
- docs/standards/backend/<stack>/security.md
- docs/standards/backend/<stack>/testing.md

frontend (해당 시):
- docs/standards/frontend/*.md

database (해당 시):
- docs/standards/database/*.md
```

로드한 표준은:
- 아키텍처 결정의 **근거**로 인용 ("이 표준의 X 원칙에 따라 ...")
- 산출물의 "Applicable Standards" 섹션에 **상대경로 링크**로 추가

표준 문서가 없으면 (예: `docs/standards/` 부재) 경고만 남기고 진행:
```
⚠️ 팀 표준 문서를 찾을 수 없어 일반 원칙 기반으로 진행합니다.
   필요하면 /sdlc:init 재실행으로 표준 번들을 설치할 수 있습니다.
```

## 6단계: 참석자 선정 및 페르소나 로드

### 기본 참석자
- **`architect`** (주도)
- **`facilitator`** (진행자)

### 주제 기반 추가
- 백엔드 스택 감지 → `backend`
- 프론트엔드 스택 감지 → `frontend`
- DB 변경·데이터 파이프라인·ML 암시 → `data`
- 보안·인증·개인정보·규제 FR/NFR → `compliance`
- 인프라·배포·SLO·비용 중요 → `platform`
- 모바일 → `techlead` (Mobile 모자)
- 사용자 조사·UX·문서 → `discovery`

각 페르소나 `${CLAUDE_PLUGIN_ROOT}/agents/<이름>.md` 를 `Read`.

### 프로젝트 오너
결정 필요 시 `CLAUDE.md` 오너 섹션의 오너에게 질의.

## 7단계: 아키텍처 회의 진행

한 응답 안에서 진행자 + 각 참석자 역할 수행. 사용자 결정 필요 시 멈춤.

### 발화 형식
```
**[이모지] [이름] ([역할]):**
(3-6 문단, 트레이드오프·근거 포함)
```

### 라운드 구조

#### Round 1: 컨텍스트 정렬 (architect)
- PRD 의 FR/NFR 요약
- "이 시스템은 무엇이고, 무엇이 아닌가?"
- 외부 시스템 경계 식별

#### Round 2: 후보 아키텍처 (architect + 도메인 전문가)
- **2-3개 대안** 제시 (예: 모놀리식 vs 서비스 분리 vs 기존 확장)
- 각 대안의 장단점·비용·리스크 표로 정리
- 팀 표준·기존 시스템과의 정합성 검토

#### Round 3: 선택 및 상세
- 채택안 결정 (architect 주도, 오너 확인)
- **컴포넌트 분해**: 이름·책임·경계
- **데이터 모델**: 주요 엔티티와 관계
- **API 계약 개요**: 핵심 엔드포인트 또는 이벤트
- **외부 의존성**: 3rd party API, 인프라

#### Round 4: 횡단 관심사
- **보안·규제** (compliance): 인증·권한·암호화·감사·개인정보
- **성능** (architect/backend): 병목·캐싱·비동기
- **관찰성** (platform): 로그·메트릭·트레이싱
- **배포·운영·비용** (platform): 환경·롤아웃·롤백·비용

#### Round 4.5: 구현 테크닉 · 패턴 (필수 · 원칙→테크닉 갭 방지)

> **왜**: "원칙" (예: "SSR 충돌 → `'use client'` + `useEffect` 에서만 접근") 만 기록하고 끝나면, 구현 시 **구체 패턴** (예: `loadedRef` 로 mount 후 첫 save 스킵) 이 빠져 버그로 이어진다. 이 라운드는 **원칙이 만들어내는 구체 코드 패턴까지** 한 단계 더 내려가 기록한다. (`todo-app` feature 회고에서 `loadedRef` 누락이 발견되어 추가된 라운드)

각 횡단 관심사 결정마다 **"원칙 → 구체 패턴"** 쌍을 확인:

| 관심사 | 원칙 (Round 4 결정) | 구체 구현 패턴 | 왜 이 패턴이 필요한가 |
|---|---|---|---|
| SSR + 클라이언트 저장소 | `useEffect` 에서만 접근 | `loadedRef.current` 로 mount 후에만 write | mount 전 기본 state 가 localStorage 덮어쓰기 방지 |
| 인증 토큰 저장 | httpOnly 쿠키 | `Secure` + `SameSite=Lax` + CSRF 토큰 동반 | XSS 및 CSRF 동시 방어 |
| DB 마이그레이션 | 온라인 마이그레이션 | 2-phase (add column nullable → backfill → set not null) | 다운타임 없이 large table 변경 |
| ... | ... | ... | ... |

해당 관심사의 **구체 패턴이 자명하거나 표준 문서에 이미 있으면** "표준 `<경로>` 참조" 로 짧게 처리. 그러나 **표준에 없는 프로젝트별 테크닉은 반드시 여기 기록** — 이 문서가 "왜 이렇게 짰나" 의 유일한 출처가 될 수 있기 때문.

모를 때는 추정 금지. "TBD — spike 필요" + 오픈 이슈 등록.

#### Round 5: 리스크 / 대안·폐기 결정
- 기술적 리스크 🔴/🟡/🟢 + 완화
- **폐기한 대안**의 이유 명시 (나중 재검토용)

### 규칙
- **표준과 다른 결정**은 예외 사유를 반드시 명시 (Applicable Standards 섹션에)
- 숫자에 확신 없으면 "TBD — 벤치 필요" 로 표기 (가짜 단정 금지)
- 사용자 결정 필요 순간 즉시 멈추고 질의

## 8단계: 산출물 작성

```markdown
# Architecture: {제목}

- **식별자**: <name>
- **작성일**: YYYY-MM-DD
- **참조 PRD**: docs/prd/prd-<name>.md
- **기술 스택**: {감지·확정된 스택}
- **기여자**: {참석 페르소나}
- **상태**: draft

## 컨텍스트

{시스템 경계, 외부 액터 — 텍스트 또는 Mermaid}

\`\`\`mermaid
graph TB
  User[사용자] --> API[API Gateway]
  API --> Service[Core Service]
  Service --> DB[(Postgres)]
  Service --> Cache[(Redis)]
  Service --> OAuth[OAuth Provider]
\`\`\`

## 컴포넌트

| 컴포넌트 | 책임 | 의존성 |
|---------|------|-------|
| ... | ... | ... |

## 데이터 모델

| 엔티티 | 주요 속성 | 관계 |
|-------|----------|------|
| ... | ... | ... |

(복잡하면 Mermaid ER 다이어그램 포함)

## API 계약 개요

| 메서드 | 경로 | 요약 | 비고 |
|-------|------|------|------|
| POST | /api/v1/... | ... | auth required |

(상세 스펙은 OpenAPI/스키마 파일로 분리 권장)

## 스택 선택 근거

- **왜 <스택>을 선택했는가**: 팀 역량·기존 인프라 정합성·NFR 충족 가능성
- **대안 대비 트레이드오프**: ...

## 적용되는 표준 (Applicable Standards)

아래 팀 표준 문서에 따른다. 벗어날 경우 각 항목 옆에 예외 사유 명시.

- [docs/standards/backend/{stack}/api.md](../standards/backend/{stack}/api.md)
- [docs/standards/backend/{stack}/structure.md](../standards/backend/{stack}/structure.md)
- [docs/standards/backend/{stack}/security.md](../standards/backend/{stack}/security.md)
- [docs/standards/backend/{stack}/testing.md](../standards/backend/{stack}/testing.md)
- (추가 표준 문서들)

### 표준 예외
- {있으면 표준 파일명 + 예외 사유. 없으면 "없음"}

## 보안

- 인증: ...
- 권한: ...
- 암호화: 전송·저장
- 감사: ...

## 성능

- 주요 SLI/SLO:
  | 지표 | 목표 | 측정 |
- 병목·캐싱·비동기 처리 전략

## 관찰성

- 로그: ...
- 메트릭: ...
- 트레이싱: ...

## 구현 테크닉 · 패턴

Round 4.5 에서 확정된 "원칙 → 구체 패턴" 매핑. 이 섹션이 "왜 이렇게 짰나"의 유일한 출처가 될 수 있다.

| 관심사 | 원칙 | 구체 구현 패턴 | 근거 |
|---|---|---|---|
| {예: SSR+localStorage} | {예: useEffect 에서만 접근} | {예: loadedRef 로 mount 후 첫 save 스킵} | {왜 이 테크닉이 필요한가 — 안 쓰면 어떤 버그} |

**필수 규칙**: 표준 문서에 이미 있는 패턴은 "표준 `<경로>` 참조" 로 짧게. 프로젝트별 테크닉은 반드시 전체 기록.

## 배포 / 운영

- 환경: dev / staging / prod
- 배포 전략: blue-green / canary / rolling
- 롤백 기준

## 대안 및 폐기 결정

| 대안 | 내용 | 폐기 사유 |
|-----|------|----------|
| A | ... | ... |
| B | ... | ... |

## 리스크

| ID | 등급 | 리스크 | 완화 | 담당 |
|----|------|-------|------|------|
| R1 | 🔴 | ... | ... | ... |

## 오픈 이슈
- [ ] ...

## 반대 의견 보존
{회의 중 채택 안 된 의견}

## 회의 로그
{전체 발언 순서·헤더 보존}

## 다음 단계
- [ ] 실행 계획 생성: `/sdlc:plan` (current feature 사용)
```

## 9단계: 최종 보고

```
✅ 아키텍처 설계 완료

Feature: {제목}
식별자: <name>
입력: docs/prd/prd-<name>.md
산출물: docs/architecture/architecture-<name>.md

요약:
- 기술 스택: {스택}
- 컴포넌트 N개
- 적용 표준 M개 / 예외 K건
- 리스크: 🔴 N / 🟡 M
- 오픈 이슈: N

다음 단계:
  /sdlc:plan              — current feature 이어받아 Epic→Story→Task 분해
```

## 주의사항

- **Applicable Standards 섹션은 반드시** 포함 — 표준이 없어도 "없음"이라고 기록.
- 스택 확정 전에는 임의로 `docs/standards/*` 링크를 넣지 말 것.
- 다이어그램은 간결하게 — 모든 세부를 다이어그램으로 그리지 말 것.
- 숫자·벤치 결과에 확신 없으면 "TBD" + 오픈 이슈 등록.
- 기존 아키텍처를 갱신하면 반드시 `architecture-<name>-history.md` 로 백업하고 `## 변경 이력` 섹션 추가.
- 산출물 최상단 "식별자"는 `<name>` 과 정확히 일치 (후속 `/sdlc:plan` 의 입력).
- 회의 전체를 한 응답 안에서 끝내되, 사용자 결정 지점에선 멈추고 대기.
