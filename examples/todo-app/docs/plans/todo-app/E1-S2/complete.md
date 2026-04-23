---
story_id: E1-S2
feature: todo-app
stage: complete
saved_at: 2026-04-23T11:20:00
branch: story/E1-S2-toggle-complete
---

# ✅ E1-S2 완료

## 요약
- Story: 완료 토글
- 크기: S (예상 S, 편차 0)
- 소요: ~15분

## 변경된 파일

**신규 (0개)**: 없음

**수정 (2개)**:
- `components/todo-app.tsx` — `toggleTodo` 를 `TodoList` 에 prop 으로 연결
- `components/todo-item.tsx` — 체크박스 `onChange={() => onToggle(todo.id)}` wire-up, `done: true` 일 때 `line-through` + `text-slate-400`

## 신규 의존성
없음.

## 설계 대비 차이
없음.

## 알려진 이슈·후속
- E1-S3: 토글 후 새로고침하면 원복 (영속화 미구현)

## AC 검증

- AC-1 ✅ — 체크박스 클릭 → `done: true` + 취소선 즉시 적용
- AC-2 ✅ — 재클릭 → `done: false` + 취소선 제거
- AC-3 ✅ — `<input type="checkbox">` 는 네이티브 checkbox 역할 · `aria-label` 동적 전환 (완료/미완료 표시에 따라)

## 커밋 제안

```
feat(todo-app): E1-S2 완료 토글 + 취소선 스타일

- TodoItem 체크박스를 onToggle 핸들러에 연결
- done=true 일 때 text-slate-400 + line-through
- aria-label 은 상태 기반 동적 문구

Refs: docs/plans/plan-todo-app.md#E1-S2
```

## 다음 Story 제안

- **E1-S3: localStorage 영속화** (크리티컬 패스, 담당: frontend)
