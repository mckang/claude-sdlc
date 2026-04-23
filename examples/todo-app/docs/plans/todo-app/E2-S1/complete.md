---
story_id: E2-S1
feature: todo-app
stage: complete
saved_at: 2026-04-23T13:10:00
branch: story/E2-S1-filter
---

# ✅ E2-S1 완료

## 요약
- Story: 필터 (all / active / completed)
- 크기: S (예상 S, 편차 0)
- 소요: ~20분

## 변경된 파일

**신규 (1개)**:
- `components/todo-filter.tsx` — 탭 UI, `role="tablist"` · `aria-pressed` · `aria-selected`

**수정 (2개)**:
- `lib/types.ts` — `FILTERS`, `FILTER_LABELS` 상수 추가
- `components/todo-app.tsx` — `filter` state 추가, `visibleTodos` 를 `useMemo` 로 파생

## 신규 의존성
없음.

## 설계 대비 차이
없음.

## 알려진 이슈·후속

필터 `visibleTodos.length === 0` 이지만 `todos.length > 0` 일 때 "이 필터에 해당하는 항목이 없습니다" 안내를 표시 — PRD 에 명시되지 않았으나 빈 필터 결과를 침묵시키면 UX 상 혼란. 선제 추가. PRD 에 **AC-F** 로 소급 기재 권장 (follow-up 문서 갱신).

## AC 검증

- AC-1 ✅ — 초기 `filter` state `"all"`
- AC-2 ✅ — "미완료" 탭 → `done: false` 만 렌더
- AC-3 ✅ — "완료" 탭 → `done: true` 만 렌더
- AC-4 ✅ — 활성 탭은 `bg-slate-900 text-white`, 비활성은 slate-500
- AC-5 ✅ — 새로고침 시 `filter` 는 `"all"` 초기화 확인 (URL·localStorage 미저장)

## 커밋 제안

```
feat(todo-app): E2-S1 필터 탭 (all/active/completed)

- TodoFilter 컴포넌트: role="tablist" + aria-pressed
- useMemo 로 visibleTodos 파생 (state 중복 방지)
- 필터 결과 0건 시 별도 안내 문구 (PRD 소급 AC)

Refs: docs/plans/plan-todo-app.md#E2-S1
```

## 다음 Story 제안

- **E2-S2: 통계 + 빈 상태 + 완료 지우기** (M2 최종, 담당: frontend)
