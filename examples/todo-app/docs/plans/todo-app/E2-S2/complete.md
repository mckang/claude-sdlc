---
story_id: E2-S2
feature: todo-app
stage: complete
saved_at: 2026-04-23T13:55:00
branch: story/E2-S2-stats-empty-state
---

# ✅ E2-S2 완료

## 요약
- Story: 통계 + 빈 상태 + "완료 지우기"
- 크기: S (예상 S, 편차 0)
- 소요: ~25분

## 변경된 파일

**신규 (1개)**:
- `components/todo-footer.tsx` — 남은 개수 + 완료 지우기 버튼

**수정 (2개)**:
- `lib/use-todos.ts` — `clearCompleted()` 추가
- `components/todo-app.tsx` — `remaining` · `completed` `useMemo` 파생, `isEmpty` 분기로 빈 상태 안내 · 필터·푸터 조건부 렌더

## 신규 의존성
없음.

## 설계 대비 차이

빈 상태일 때 **필터 탭·푸터를 숨김** — PRD AC-D 에는 "빈 상태 안내" 만 명시됐고 필터·푸터 숨김은 암묵. Architect(Tony) 의 UX 원칙("아무 것도 조작할 게 없을 때 컨트롤을 보여주지 말자") 에 기반한 판단.

## AC 검증

- AC-1 ✅ — `remaining` 값을 `<span aria-live="polite">` 로 footer 왼쪽에 표시
- AC-2 ✅ — `completed > 0` 일 때 "완료 N개 지우기" 버튼 활성화
- AC-3 ✅ — 버튼 클릭 → `clearCompleted()` → `done: true` 전부 제거 + localStorage 반영
- AC-4 ✅ — 전체 0건일 때 "아직 할 일이 없습니다..." 점선 박스 · footer 숨김
- AC-5 ✅ — 1건 추가 즉시 빈 상태 안내 사라지고 리스트·필터·푸터 노출

## DoD 검증

- [x] 모든 AC 수동 확인 완료
- [x] Lighthouse (Chrome DevTools, Mobile · Simulated Fast 3G):
  - Performance 96
  - Accessibility 100
  - Best Practices 100
  - SEO 100
  - → PRD NFR (Performance ≥ 90) 충족

## 커밋 제안

```
feat(todo-app): E2-S2 통계·빈 상태·완료 지우기

- TodoFooter: 남은 개수 + 완료 지우기 버튼
- clearCompleted 훅 메서드 추가
- 빈 상태는 안내 박스 노출 + 필터/푸터 숨김

Refs: docs/plans/plan-todo-app.md#E2-S2
```

## Plan 달성

M2 (E2 완료) ✓ — PRD 의 모든 AC 통과, 릴리스 기준 충족.

다음 액션:
- `/sdlc:pr E2-S2` 로 PR 본문 생성
- `/sdlc:retrospective` (feature 회고) — SDLC 플러그인 예제 목적상 생략 가능
