# SDLC Plugin Rules

이 프로젝트는 `sdlc` Claude Code 플러그인을 사용한다. Claude 는 아래 규칙을 **자동으로** 준수한다.

## 1. 맥락 로딩 (세션 시작 시)
프로젝트 작업을 시작할 때 반드시 다음을 먼저 읽는다:
- `CLAUDE.md` 의 `## Current Feature` 섹션 — 현재 작업 중인 feature 이름 (`<name>`)
- `docs/plans/plan-<name>.md` — 현재 Plan
- `docs/prd/prd-<name>.md` — 요구사항
- `docs/architecture/architecture-<name>.md` — 설계
- `docs/features/feature-<name>.md` — 최초 아이디어
- `docs/standards/` — 스택 관련 표준

## 2. Story 단위 작업
개발은 Story 단위로. `/sdlc:story start` → 사용자 승인 → 구현 → `/sdlc:story verify` → `/sdlc:story complete`.

## 3. 구현 중 금지
- 표준 위반
- 설계 외 기능 "겸사겸사" 추가
- 테스트 느슨하게 만들기

## 4. 결정 지점
임의 판단 금지. 중단하고 사용자 문의 또는 `/sdlc:meeting` 제안.

## 5. Plan 갱신
Task 상태는 즉시 체크박스로: `[ ]` `[~]` `[!]` `[x]`.

## 6. PR
Story 완료 시 `/sdlc:pr` 로 본문 생성.

---

## Current Feature
- name: todo-app
- updated: 2026-04-23

---

## 프로젝트 오너
- **이름**: Thomas Kang
- **역할**: 최종 의사결정자. 미팅·토론 중 결정이 필요하면 반드시 이 사용자에게 질의.
