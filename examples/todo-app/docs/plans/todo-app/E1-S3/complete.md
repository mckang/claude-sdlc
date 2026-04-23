---
story_id: E1-S3
feature: todo-app
stage: complete
saved_at: 2026-04-23T12:05:00
branch: story/E1-S3-localstorage
---

# ✅ E1-S3 완료

## 요약
- Story: localStorage 영속화
- 크기: M (예상 M, 편차 0)
- 소요: ~30분. Hydration mismatch 방지 패턴(SSR-safe) 이 핵심

## 변경된 파일

**신규 (2개)**:
- `lib/storage.ts` — `loadTodos()` · `saveTodos()` · `isTodo()` 가드
- `lib/use-todos.ts` — `useTodos` hook: mount 시 load, state 변경마다 write-through

**수정 (1개)**:
- `components/todo-app.tsx` — in-memory `useState` → `useTodos()` hook 호출로 교체

## 신규 의존성
없음 (브라우저 기본 API 만 사용).

## 설계 대비 차이

없음. 아키텍처 §4 의 "상태 단일 소스: hook 내부 state, localStorage 는 write-through cache" 원칙 그대로.

**구현 주의**: `loadedRef.current` 로 최초 mount 시 load 완료 플래그를 관리해 **초기 빈 배열 상태가 localStorage 에 덮어쓰이지 않도록** 방어. 이 패턴은 아키텍처에 명시되지 않았으나 구현상 필수 — 다음 개정 시 아키텍처 §6 "SSR 충돌" 항목에 추가 권장 (follow-up).

## 알려진 이슈·후속

- 동시 탭 동기화 미지원 (PRD §9 가정) — `storage` 이벤트 리스너 추가는 OoS
- localStorage 용량 초과 시 `setItem` 예외는 `console.error` 만 남김. 사용자 피드백 UX 없음 — PRD NFR 미언급

## AC 검증

- AC-1 ✅ — DevTools Application → Local Storage → `todo-app:v1:items` 에 JSON 배열 확인. add/toggle/delete 각각 직후 갱신됨
- AC-2 ✅ — 새로고침 후 순서·완료 상태 모두 복원
- AC-3 ✅ — DevTools 에서 `localStorage.setItem('todo-app:v1:items', 'garbage')` → 새로고침 → 빈 리스트 + `console.warn` 출력
- AC-4 ✅ — Next.js dev 경고 패널 clean (React hydration mismatch 0건)

## 커밋 제안

```
feat(todo-app): E1-S3 localStorage 영속화 (SSR-safe)

- lib/storage.ts: JSON parse try/catch + 배열·필드 가드
- lib/use-todos.ts: mount 후에만 load, loadedRef 로 첫 save 스킵
- todo-app.tsx: 로컬 state 제거, hook 사용으로 단순화

Refs: docs/plans/plan-todo-app.md#E1-S3
```

## 다음 Story 제안

- **E2-S1: 필터 (all/active/completed)** (M1 달성 후 M2 진입, 담당: frontend)

M1 (E1 완료) 달성 ✓.
