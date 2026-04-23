# 실행 계획: 로컬 저장 Todo 관리 웹앱

- **작성일**: 2026-04-23
- **참조 PRD**: [../prd/prd-todo-app.md](../prd/prd-todo-app.md)
- **참조 아키텍처**: [../architecture/architecture-todo-app.md](../architecture/architecture-todo-app.md)
- **기술 스택**: Next.js 14 App Router · TypeScript · Tailwind · localStorage
- **상태**: in_progress

## 요약
- Epic: 2개
- Story: 5개
- Task: 18개
- 예상 기간: 0.5주 (예제 규모)
- 마일스톤: 2개

## 마일스톤

| ID | 이름 | 목표일 | 기준 |
|----|------|--------|------|
| M1 | Core CRUD + 영속화 | day 1 | E1 완료, 기본 Todo 흐름 전체 동작 |
| M2 | UX Polish 릴리스 | day 2 | E2 완료, PRD 의 모든 AC 통과 |

## Epic·Story·Task 분해

### E1: Core CRUD + 영속화
**목표**: Todo 추가·완료·삭제가 localStorage 로 유지되는 최소 동작앱.
**예상 크기**: M + S + M = 합 M
**마일스톤**: M1

#### E1-S1: Todo 추가·삭제 (in-memory)
- **담당 영역**: frontend
- **크기**: M
- **설명**: Next.js 앱 스캐폴드 + 폼 + 리스트 + 개별 삭제. 영속화는 S3 에서 붙임.
- **수용 기준**:
  - AC-1: Given 빈 앱 When 텍스트 입력 후 Enter Then 리스트 최상단에 새 항목이 나타난다
  - AC-2: Given 공백만 입력 When 제출 Then 추가되지 않고 입력창은 그대로
  - AC-3: Given 항목이 있을 때 When 삭제 버튼 클릭 Then 해당 항목만 사라진다
  - AC-4: Given 201자 이상 입력 Then 입력이 200자에서 잘린다
- **DoD**:
  - [x] 수동 테스트: 위 4개 AC 재현
  - [x] TypeScript strict 통과
  - [x] 접근성: Tab 으로 입력·삭제 버튼 포커스 가능

**Task**:
| ID | 제목 | 담당 | 크기 |
|----|------|------|------|
| E1-S1-T1 | `package.json` · `tsconfig.json` · `tailwind.config.ts` · `next.config.mjs` 스캐폴드 | frontend | S |
| E1-S1-T2 | `app/layout.tsx` · `app/page.tsx` · `app/globals.css` | frontend | S |
| E1-S1-T3 | `lib/types.ts` (Todo·Filter) | frontend | S |
| E1-S1-T4 | `components/todo-form.tsx` + `todo-item.tsx` + `todo-list.tsx` | frontend | M |
| E1-S1-T5 | `components/todo-app.tsx` 최상위 조립 (in-memory state) | frontend | S |

#### E1-S2: 완료 토글
- **담당 영역**: frontend
- **크기**: S
- **설명**: 체크박스 클릭 시 `done` 플래그 토글 + 시각 표현(취소선·회색).
- **수용 기준**:
  - AC-1: Given 미완료 항목 When 체크박스 클릭 Then `done: true` 로 바뀌고 취소선 적용
  - AC-2: Given 완료 항목 When 다시 클릭 Then `done: false` 로 복귀
  - AC-3: 체크박스는 `role="checkbox"` 접근성 속성을 가진다
- **DoD**:
  - [x] 위 3개 AC 수동 확인
  - [x] 체크박스 상태 변화가 aria-checked 로 반영

**Task**:
| ID | 제목 | 담당 | 크기 |
|----|------|------|------|
| E1-S2-T1 | `todo-app.tsx` 에 `toggleTodo(id)` 추가 | frontend | S |
| E1-S2-T2 | `todo-item.tsx` 의 체크박스 wire-up + Tailwind 취소선 클래스 | frontend | S |

#### E1-S3: localStorage 영속화
- **담당 영역**: frontend
- **크기**: M
- **설명**: `lib/storage.ts` 추상화 + `lib/use-todos.ts` hook. SSR 안전(effect 안에서만 접근).
- **수용 기준**:
  - AC-1: 항목 추가·토글·삭제 직후 localStorage `todo-app:v1:items` 에 최신 배열이 기록된다
  - AC-2: 새로고침 후에도 항목이 동일한 순서로 복원된다
  - AC-3: localStorage 에 깨진 JSON 이 있으면 `[]` 로 fallback + `console.warn`
  - AC-4: SSR 에서 hydration mismatch 경고가 발생하지 않는다
- **DoD**:
  - [x] AC 4개 수동 검증
  - [x] `useEffect` 외부에서 `localStorage` 직접 접근 없음
  - [x] storage key 는 `todo-app:v1:items` 로 고정

**Task**:
| ID | 제목 | 담당 | 크기 |
|----|------|------|------|
| E1-S3-T1 | `lib/storage.ts` — read/write + JSON 파싱 try/catch | frontend | S |
| E1-S3-T2 | `lib/use-todos.ts` — load on mount + write-through | frontend | M |
| E1-S3-T3 | `todo-app.tsx` 가 hook 사용하도록 리팩토링 | frontend | S |
| E1-S3-T4 | 깨진 JSON 주입 → fallback 동작 수동 확인 | qa | S |

### E2: UX Polish
**목표**: 필터·통계·빈 상태. PRD 의 남은 AC 전부 통과.
**예상 크기**: S + S = 합 S
**마일스톤**: M2

#### E2-S1: 필터 (all · active · completed)
- **담당 영역**: frontend
- **크기**: S
- **설명**: 상단 또는 리스트 상단에 탭 3개. 선택된 필터에 맞춰 리스트만 변화. URL 변경 없음.
- **수용 기준**:
  - AC-1: 기본 필터는 `all`
  - AC-2: `active` 선택 시 `done: false` 항목만 표시
  - AC-3: `completed` 선택 시 `done: true` 항목만 표시
  - AC-4: 필터 탭은 현재 선택을 시각적으로 구분(활성 탭 스타일)
  - AC-5: 필터 상태는 URL/localStorage 에 저장 **안 함** (새로고침하면 `all` 로 초기화)
- **DoD**:
  - [x] 5개 AC 수동 확인
  - [x] 활성 탭에 `aria-pressed="true"`

**Task**:
| ID | 제목 | 담당 | 크기 |
|----|------|------|------|
| E2-S1-T1 | `components/todo-filter.tsx` 작성 | frontend | S |
| E2-S1-T2 | `todo-app.tsx` 에 `filter` state + `visibleTodos` 계산 | frontend | S |

#### E2-S2: 통계 + 빈 상태 + "완료 지우기"
- **담당 영역**: frontend
- **크기**: S
- **설명**: 하단 footer: "N개 남음", "완료 M개 지우기" 버튼. 전체 0건일 때 빈 상태 안내.
- **수용 기준**:
  - AC-1: 미완료 개수를 "X개 남음" 으로 footer 에 표시
  - AC-2: 완료 항목이 1건 이상이면 "완료 N개 지우기" 버튼이 활성화됨
  - AC-3: 해당 버튼 클릭 시 완료 항목 전부 삭제 + localStorage 반영
  - AC-4: 전체 리스트 0건일 때 "아직 할 일이 없습니다..." 안내 + footer 숨김
  - AC-5: 1건 추가 즉시 빈 상태 안내가 사라짐
- **DoD**:
  - [x] 5개 AC 수동 확인
  - [x] Lighthouse Performance ≥ 90 (모바일)

**Task**:
| ID | 제목 | 담당 | 크기 |
|----|------|------|------|
| E2-S2-T1 | `components/todo-footer.tsx` 작성 | frontend | S |
| E2-S2-T2 | `todo-app.tsx` 에 `clearCompleted()` + 빈 상태 분기 | frontend | S |
| E2-S2-T3 | Lighthouse 수동 측정 + 결과 README 에 기록 | qa | S |

## 크리티컬 패스

`E1-S1 (스캐폴드·기본 CRUD)` → `E1-S2 (완료 토글)` → `E1-S3 (영속화)` → `E2-S1 (필터)` → `E2-S2 (통계·빈 상태)`

병렬 여지 없음 (규모가 작고 동일 파일들을 순차 확장). 상세는 [plan-todo-app.deps.md](plan-todo-app.deps.md).

## 리스크 및 완화

| ID | 등급 | 내용 | 완화 전략 | 담당 |
|----|------|------|-----------|------|
| R1 | 🟡 | SSR 와 localStorage 의 hydration mismatch | `'use client'` + `useEffect` 에서만 접근. 초기 렌더는 빈 배열 | frontend |
| R2 | 🟢 | localStorage 용량 초과 | 예제 범위에서는 발생 불가 가정, PRD "가정" 섹션에 기재 | — |
| R3 | 🟢 | 사용자가 JSON 을 임의 편집해 깨뜨림 | try/catch → `[]` fallback + warn | frontend |

## 가정 및 미결 사항

- 가정: 모던 브라우저만 지원 (crypto.randomUUID, localStorage, ES2020)
- 가정: 테스트(vitest/playwright)는 이번 예제 범위 외. Plan 의 DoD 는 수동 검증 기준

## 반대 의견 보존

- **Tony (Architect)**: "테스트 없이 예제 내보내는 게 표준에 어긋난다." — 채택 유보. 이 예제는 **SDLC 산출물 레퍼런스**가 주 목적이며, 테스트 자체는 `standards/frontend/testing.md` 참조. 추후 v2 에서 vitest 예제 추가 고려.
- **Clint (QA)**: "E1-S3 AC-3(깨진 JSON) 을 Story 아닌 별도 테스트 Story 로 분리하자." — 예제 경량화 위해 동일 Story 에 포함, DoD 수동 확인으로 타협.

## 회의 로그

이 예제는 **플러그인 Claude 가 혼자 진행**한 오프라인 Plan 생성이다. 실제 `/sdlc:plan` 은 4-round 회의 형식으로 각 페르소나 발언 블록을 채운다 — 참고: [commands/plan.md](../../../../commands/plan.md) Round 1~4.

회의 개요:
- Round 1 (Epic): SM·PM·Architect → E1/E2 두 개로 합의
- Round 2 (Story): E1 에서 5 → 3 축소(XL 없음 확인), E2 는 2개
- Round 3 (Task): 각 Story 2~5개로 분해. XL 없음
- Round 4 (의존성·리스크): 크리티컬 패스 5-Story 선형, R1-R3 식별
