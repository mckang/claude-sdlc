---
story_id: E1-S1
feature: todo-app
stage: kickoff
saved_at: 2026-04-23T09:15:00
branch: story/E1-S1-todo-add-delete
---

# 🚀 E1-S1 킥오프: Todo 추가·삭제 (in-memory)

## 목표
Next.js 앱 스캐폴드 + 입력 폼 + 리스트 + 개별 삭제. localStorage 영속화는 E1-S3 에서 붙인다.

## 수용 기준
- AC-1: Given 빈 앱 When 텍스트 입력 후 Enter Then 리스트 최상단에 새 항목이 나타난다
- AC-2: Given 공백만 입력 When 제출 Then 추가되지 않고 입력창은 그대로
- AC-3: Given 항목이 있을 때 When 삭제 버튼 클릭 Then 해당 항목만 사라진다
- AC-4: Given 201자 이상 입력 Then 입력이 200자에서 잘린다

## Task 목록
1. E1-S1-T1: 프로젝트 설정 파일 스캐폴드 (frontend, S)
2. E1-S1-T2: app/ 루트 파일 (frontend, S)
3. E1-S1-T3: `lib/types.ts` (frontend, S)
4. E1-S1-T4: 폼 + 아이템 + 리스트 컴포넌트 (frontend, M)
5. E1-S1-T5: 최상위 `todo-app.tsx` 조립 (frontend, S)

## 접근 방법

### 예상 변경 파일
**신규 생성:**
- `package.json` · `tsconfig.json` · `next.config.mjs` · `tailwind.config.ts` · `postcss.config.js` · `next-env.d.ts` · `.gitignore` — 프로젝트 설정
- `app/layout.tsx` · `app/page.tsx` · `app/globals.css` — Next.js 루트
- `lib/types.ts` — `Todo`, `Filter` 타입
- `components/todo-form.tsx` — 입력 폼 (controlled, 공백 검증, 200자 제한)
- `components/todo-item.tsx` — 단일 항목 (체크박스는 S2 준비해 두되 본 Story 에서는 no-op 허용)
- `components/todo-list.tsx` — 리스트 래퍼
- `components/todo-app.tsx` — 최상위 상태 보유 (in-memory `useState<Todo[]>`)

### 신규 의존성
`next@14` · `react@18` · `tailwindcss@3` · `typescript@5` — 예제 레퍼런스 스택. 아키텍처 문서 §1 에서 합의됨.

### 참조 표준
- `docs/standards/backend/nextjs-typescript/structure.md` — `app/` 레이아웃, 파일 명명
- `docs/standards/frontend/nextjs.md` — `'use client'` 경계
- `docs/standards/frontend/styling-tailwind.md` — 유틸리티 우선, 중복 클래스 회피

### 관련 기존 코드
없음 (신규 프로젝트).

### 구현 순서 제안
1. 설정 파일부터 (T1) — build 가 돌지 않으면 나머지 검증 불가
2. 루트 파일 (T2) — "Hello" 가 보이는 것 먼저
3. 타입 (T3) → 폼/아이템/리스트 (T4) → 최상위 조립 (T5)
4. 각 단계마다 `npm run typecheck` 으로 tsconfig strict 통과 확인

## ⚠️ 확인 필요 사항

없음 — PRD·아키텍처가 스택·UX·데이터 모델을 모두 확정했다.

## 다음 액션

선택하세요:
- (a) 위 접근으로 진행 — "구현 시작"이라고 답해주세요
- (b) 접근 방법 조정 필요
- (c) 확인 필요 사항부터 해결
