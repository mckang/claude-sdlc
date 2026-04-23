---
name: sdlc-plan-review
description: Use when user asks to review a plan, after /sdlc:plan completes, or before confirming an Epic/Story decomposition — runs 4+3 axis team persona review
---

# Plan Review 세션

## 입력 파악

대화 맥락에서 다음을 파악한다 (없으면 current feature 사용):
- **Plan 파일**: 명시 경로 또는 feature 이름 → `resolve-plan-path.sh` 로 resolve
- **스코프**: `--scope=all` (기본) | `m1`/`m2` | `epic:E1`
- **산출물 경로**: 명시 없으면 `<plan basename>.review.md`

Plan 없으면 중단.

## 입력 문서 로드

- Plan 파일 `Read` — Epic/Story/Task 수·크기 분포·마일스톤·리스크 목록 추출
- `<plan>.deps.md` 있으면 `Read` (없으면 경고만)
- Plan이 참조하는 PRD·아키텍처·표준 문서 `Read`

## 참석자 선정

| 필수 | 자동 추가 (Plan 담당 영역 기반) |
|------|-------------------------------|
| facilitator, scrum-master, planner, architect, techlead | backend / frontend / data / qa / compliance / pm |

상한 8명. 각 `${CLAUDE_PLUGIN_ROOT}/agents/<이름>.md` Read.

## 4+3 축 리뷰

**메인 Claude가 모든 참석자 역할을 한 응답 안에서 완료. 중간에 "계속할까요?" 금지.**

발언 형식: `**[이모지] [이름] ([역할]):**`

| 라운드 | 축 | 주도 페르소나 | Finding ID |
|--------|---|--------------|-----------|
| 1 | Epic 경계 — 크기·중첩·누락·모듈 경계 | scrum-master + architect + pm | F-E-nnn |
| 2 | Story 품질 — INVEST·XL 탐지·수직슬라이스·DoD·Task 분해 | scrum-master + 담당영역 | F-S-nnn |
| 3 | AC 모호성 — 측정불가·경계값·실패경로·비결정 요소 | qa + scrum-master | F-A-nnn |
| 4 | 의존성 누락 — 하드/소프트 분류·크리티컬패스·순환 | planner + architect | F-D-nnn |
| 5a | DoD 완전성 | scrum-master | F-X-nnn |
| 5b | 표준 위반 | architect + 담당영역 | F-X-nnn |
| 5c | Bus factor 1 | techlead | F-X-nnn |
| 5d | 리스크 커버리지 | planner | F-X-nnn |

**Finding 필수 4요소**: ID + 심각도(🔴 Blocker / 🟡 Concern / 🟢 Nitpick) + 근거(문서 섹션 인용) + 권고안

**Finding 상태**: ✅ 수용 | 🔍 보류 | ❌ 거절

## 산출물 저장

`$OUT` 에 다음 섹션으로 저장:
1. 헤더 (리뷰일·Plan·스코프·참석자)
2. Finding 요약 표 (축별 🔴/🟡/🟢 카운트)
3. Finding 상세 (F-E-nnn ~ F-X-nnn)
4. 수용된 Finding의 Plan 수정안 표
5. 보류 Finding — 사용자 결정 요청 표
6. 회의 로그

저장 후 Plan 상단 "## 📝 리뷰 이력" 섹션에 추가 여부 사용자 확인 후 작성.

## 주의사항

- **Plan 자동 수정 금지** — Finding은 제안, 결정은 사용자
- Blocker는 엄격하게 (남발 금지)
- 근거 없는 "느낌상" 발언 금지
- 이미 `[~]`/`[x]` 인 Story의 Blocker는 🟡 Concern으로 강등
