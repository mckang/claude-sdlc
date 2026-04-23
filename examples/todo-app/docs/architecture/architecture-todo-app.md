# Architecture: 로컬 저장 Todo 관리 웹앱

- **식별자**: todo-app
- **작성일**: 2026-04-23
- **작성자**: Architect (Tony)
- **참조 PRD**: [prd-todo-app.md](../prd/prd-todo-app.md)
- **상태**: approved

## 1. 결정 요약

| 결정 | 선택 | 이유 |
|---|---|---|
| 런타임 | Next.js 14 App Router + React 18 | 플러그인 표준(`standards/backend/nextjs-typescript`, `frontend`) 활용. CSR 만으로 충분하지만 빌드·DX 편의. |
| 언어 | TypeScript (strict) | 표준 요구. 도메인 타입(`Todo`) 명시 |
| 스타일 | Tailwind CSS | 표준 `standards/frontend/styling-tailwind.md` 준수 |
| 상태 관리 | React `useState` + custom hook | Zustand/Redux 과잉. 단일 페이지 로컬 상태 |
| 영속화 | Browser localStorage | PRD 요구. 다른 저장소(IndexedDB 등) 고려하지 않음 |
| 서버 | 없음 | 클라이언트 전용. Next.js `app/` 의 `'use client'` 컴포넌트로 구성 |
| 테스트 | — | 예제 범위에서는 생략 (Plan 에 테스트 Task 만 명시) |

**거부한 옵션**:
- Vite + React → Next.js 표준이 플러그인에 이미 있어 그걸 활용하는 게 예제로서 더 유용
- shadcn/ui → 의존 설치·초기화 과정이 학습자에게 노이즈. 순수 HTML + Tailwind 로 충분
- Zustand → 컴포넌트 트리가 얕아 prop drilling 이 문제되지 않음

## 2. 컴포넌트 구조

```
app/
├── layout.tsx        # 메타데이터 + <body> 래퍼 + Tailwind import
├── page.tsx          # 루트 페이지. 'use client'. TodoApp 마운트
└── globals.css       # Tailwind directives

components/
├── todo-app.tsx      # 최상위: 상태·필터 보유. 자식 조합
├── todo-form.tsx     # 입력 폼. onSubmit(text) 만 상위에 전달
├── todo-list.tsx     # 필터링된 배열 렌더. onToggle/onDelete 위임
├── todo-item.tsx     # 개별 항목 (체크박스 + 텍스트 + 삭제 버튼)
├── todo-filter.tsx   # all/active/completed 탭
└── todo-footer.tsx   # 남은 개수 + completed 지우기

lib/
├── types.ts          # Todo, Filter 타입
├── storage.ts        # localStorage read/write 추상화
└── use-todos.ts      # 상태 hook (load-on-mount + write-through)
```

## 3. 데이터 모델

```typescript
// lib/types.ts
export type Todo = {
  id: string;        // crypto.randomUUID()
  text: string;      // trimmed, 1-200 chars
  done: boolean;
  createdAt: number; // Date.now() — 정렬용
};

export type Filter = 'all' | 'active' | 'completed';
```

### localStorage 스키마

- **Key**: `todo-app:v1:items`
- **Value**: `Todo[]` 직렬화 JSON
- **버전 접두어 `v1`**: 장래 스키마 변경 시 migration 지점 식별

## 4. 상태 흐름

```
[mount]
  └→ useTodos()
      ├→ read localStorage → setState
      └→ (state 변경마다) write localStorage

[user interaction]
  ├→ TodoForm.onSubmit → addTodo(text)
  ├→ TodoItem.onToggle → toggleTodo(id)
  ├→ TodoItem.onDelete → deleteTodo(id)
  └→ TodoFilter.onChange → setFilter(filter)
```

상태 단일 소스: `useTodos` hook 내부의 `useState<Todo[]>`. localStorage 는 파생 저장소(write-through cache).

## 5. API · 외부 의존

**API**: 없음 (서버리스)

**외부 의존 (npm)**:
- `next` ^14
- `react` ^18
- `react-dom` ^18
- `typescript` ^5
- `tailwindcss` ^3
- `postcss`, `autoprefixer`

**거부**: date-fns, uuid(crypto.randomUUID 대체), lodash(모두 native 가능)

## 6. 보안 · 성능 · 접근성 결정

| 축 | 결정 | 근거 |
|---|---|---|
| XSS | React 기본 escape + `dangerouslySetInnerHTML` 금지 | `standards/frontend/*` 기본 |
| localStorage 오염 | JSON.parse try/catch → fallback `[]` | 외부 스크립트가 키를 깨뜨려도 복구 가능 |
| SSR 충돌 | `'use client'` + `useEffect` 에서만 localStorage 접근 | Next.js App Router 에서 hydration mismatch 방지 |
| a11y | input 에 `<label>`, 버튼에 `aria-label`, focus ring 유지 | `standards/frontend/*` |
| 성능 | 리스트 항목 수 < 수백 → 가상화 불필요. `key={todo.id}` 만 | PRD NFR 충분 |

## 7. 구현 순서 제안

Plan 단계에서 확정하되, 대략적 제안:

1. 기본 추가/삭제 (in-memory) — UX 골격 먼저
2. 완료 토글
3. localStorage 영속화 — 기능 검증 후 붙임
4. 필터 — 데이터 흐름 정돈 후
5. 푸터 통계·빈 상태 UX polish

이 순서는 [plan-todo-app.md](../plans/plan-todo-app.md) 의 Story 분해에 반영됨.

## 8. 참조 표준

- [docs/standards/backend/nextjs-typescript/structure.md](../standards/backend/nextjs-typescript/structure.md) — app/ 구조, 파일 명명
- [docs/standards/frontend/nextjs.md](../standards/frontend/nextjs.md) — Server/Client 경계
- [docs/standards/frontend/styling-tailwind.md](../standards/frontend/styling-tailwind.md) — Tailwind 규약
- [docs/standards/frontend/state-management.md](../standards/frontend/state-management.md) — local vs global state 판단

## 9. 오픈 이슈

없음.
