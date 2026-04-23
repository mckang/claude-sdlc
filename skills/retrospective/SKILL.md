---
name: sdlc-retrospective
description: Use when user asks for a retrospective, after a feature/plan is completed, or when /sdlc:story complete finishes the last story — runs KPT or 4L team retrospective
---

# 회고 (Retrospective) 세션

## 입력 파악

대화 맥락에서 파악 (없으면 current feature):
- **Plan 파일**: 명시 경로 또는 feature 이름 → `resolve-plan-path.sh` 로 resolve
- **포맷**: `--format=kpt` (기본) | `--format=4l`
- **산출물 경로**: 없으면 `${CLAUDE_PROJECT_DIR}/docs/retrospectives/retro-<name>.md`

Plan 없으면 중단.

## Plan 분석

`Read`로 Plan 로드, 수집:
- 원래 계획: Epic/Story/Task 수·크기 합산·마일스톤·크리티컬 패스·리스크
- 완료 상태: 체크박스 집계 → 완료율

미완 Story 있으면:
```
⚠️ N개 Story 미완료. 회고를 진행하시겠습니까?
(a) 완료 부분만  (b) 전체 (미완 = Problem)  (c) 중단
```

`<plan>.deps.md`, `docs/meetings/` (관련 미팅 문서)도 있으면 참고.

## 참석자 선정

| 필수 | 자동 추가 | 항상 포함 |
|------|-----------|----------|
| facilitator, scrum-master, planner | backend/frontend/data/qa/compliance (Plan 담당 영역) | pm, techlead |

상한 7명.

## 회고 진행

**메인 Claude가 모든 역할을 한 응답 안에서 완료. 중간에 "계속할까요?" 금지.**

### 오프닝 + 데이터 리뷰

계획 vs 실제 표 출력:

| 항목 | 계획 | 실제 | 차이 |
|------|------|------|------|
| Story 수 | N | N | % |
| 기간 | N주 | N주 | +X일 |
| 마일스톤 | ... | ... | — |

### KPT 포맷 (기본)

- **Keep**: 각 참석자 1-2개 — "다음에도 유지할 것"
- **Problem**: 각 참석자 1-2개 — "피하고 싶은 것" (**블레임리스** — 사람 탓 금지, 시스템·프로세스 기반)
- **Try**: Problem → 구체적 행동 전환. 각 Try에 담당자 + 완료 확인 방법 필수

### 4L 포맷 (`--format=4l`)

Liked / Learned / Lacked / Longed For. 각 참석자 1개씩. 감정·학습 초점.

### 액션 아이템

| ID | 내용 | 담당 | 확인 방법 | 우선순위 |
|----|------|------|-----------|---------|

Try → 실행 가능한 행동으로. 모호한("더 잘 소통하자") 금지.

## 산출물 저장

`$OUT` 에 저장: 헤더·계획 vs 실제 표·Keep/Problem/Try(또는 4L)·액션 아이템·주요 수치·회의 로그

같은 디렉터리에 `<name>.actions.md` 도 별도 저장 (다음 회고 때 이전 Try 이행 확인용).
