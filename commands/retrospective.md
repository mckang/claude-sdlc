---
argument-hint: [Plan|feature이름, 생략 시 current] [산출물경로, 생략 시 자동] [--format=kpt|4l]
description: 완료된 Plan에 대해 KPT 또는 4L 포맷의 회고 세션 진행
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 회고 (Retrospective) 세션

사용자가 `/retrospective [Plan|feature이름] [산출물경로] [--format=kpt|4l]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:retrospective                                          # current feature + 자동 산출물
/sdlc:retrospective checkout-v2 --format=4l                  # feature 이름 + 포맷
/sdlc:retrospective docs/plans/plan-x.md docs/retrospectives/retro-x.md   # 명시 경로
```

## 1단계: 인자 파싱

- `$1`: Plan 파일 경로 또는 feature 이름 (선택 — 생략 시 current feature)
- `$2`: 회고 산출물 저장 경로 (선택 — 생략 시 `docs/retrospectives/retro-<name>.md`)
- 포맷 플래그 (선택):
  - `--format=kpt` (기본) — Keep / Problem / Try
  - `--format=4l` — Liked / Learned / Lacked / Longed For

### Plan 경로 및 산출물 경로 resolve

```bash
# 첫 비-플래그 인자는 Plan 지시자, 두 번째는 산출물 경로
POS=()
for a in "$@"; do
  case "$a" in --*) ;; *) POS+=("$a") ;; esac
done

OUT_ARG=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-plan-path.sh" "${POS[0]:-}") || exit 1
NAME=$(sed -n 1p <<<"$OUT_ARG")
PLAN=$(sed -n 2p <<<"$OUT_ARG")
test -f "$PLAN" || { echo "❌ Plan 파일 없음: $PLAN"; exit 1; }

OUT="${POS[1]:-${CLAUDE_PROJECT_DIR}/docs/retrospectives/retro-$NAME.md}"
mkdir -p "$(dirname "$OUT")"
```

## 2단계: Plan 분석

`Read`로 Plan 문서를 읽고 다음 정보 수집:

### 원래 계획
- 총 Epic/Story/Task 수
- T-shirt size 합산 (S=1, M=3, L=6, XL=10)
- 예상 기간, 마일스톤
- 크리티컬 패스
- 당시 식별된 리스크 (🔴🟡🟢)

### 진행 상태 (체크박스 집계)
- `/status` 커맨드와 동일한 방식으로 완료·진행중·블로킹·미완 파싱
- 완료 비율 계산
- **완료 안 된 Story가 있으면** 사용자에게 경고:
  > ⚠️ Plan의 N개 Story가 아직 완료되지 않았습니다. 회고를 진행하시겠습니까?
  > 
  > (a) 완료 부분만 대상으로 진행 (권장)
  > (b) 전체 대상으로 진행 (미완 부분은 "Problem"으로 다룸)
  > (c) 중단

답변 오면 해당 방식으로 진행. 기본은 (a).

### 의존성 파일 확인
`<Plan>.deps.md` 파일 있으면 함께 읽어 크리티컬 패스 확인.

### 관련 회의 문서
`${CLAUDE_PROJECT_DIR}/docs/meetings/` 에 Plan과 관련된 이전 미팅 있는지 `Glob` 으로 찾고, 있으면 참고 자료로 로드 (예: 같은 기능명 prefix).

## 3단계: 참석자 선정

**기본 참석자** (자동):
- `facilitator` (Sean) — 진행
- `scrum-master` (Marco) — Plan 품질 회고
- `planner` (Iris) — 일정·예상 vs 실제

**자동 추가** (Plan의 "담당 영역" 에서 감지):
- backend가 Plan에 있었으면 → `backend`
- frontend → `frontend`
- data → `data`
- qa → `qa`
- compliance → `compliance`

**추가로 포함** (항상):
- `pm` (John) — 비즈니스 관점 회고
- `techlead` (Sam) — 팀 · 기술 부채 관점

합리적인 상한은 **7명 이하** — 넘으면 메인 담당 영역만 선정.

## 4단계: 회고 회의 진행

메인 Claude가 **진행자(Sean)** 와 **각 참석자** 역할을 동시에 수행. 하나의 응답 안에서 끝냄.

### 회의 구조 (KPT 포맷 기준)

**1) 오프닝 (진행자)**
- 대상 Plan 간단 요약 (Epic/Story/Task 수, 예상 N주)
- 실제 성과 요약 (완료율, 소요 일수, 달성 마일스톤)
- 회고 규칙 안내: **blameless** (사람 탓 금지, 시스템·프로세스 개선에 집중)

**2) 데이터 리뷰 (진행자 + scrum-master + planner 주도)**

다음 표를 먼저 제시:

```markdown
## 실제 vs 계획 대비

| 항목 | 계획 | 실제 | 차이 |
|------|------|------|------|
| Story 수 | 18 | 20 (2개 추가) | +11% |
| Task 수 | 52 | 58 | +12% |
| 예상 크기 | M×10 + L×8 = 78점 | 환산 90점 | +15% |
| 기간 | 6주 (버퍼 포함) | 7주 2일 | +1.3주 초과 |
| 마일스톤 달성 | M1, M2, M3 | M1, M2 지연 1주, M3 지연 2주 | — |
| 크리티컬 패스 지연 | — | E2-S1에서 1주 지연 (SES 승인) | — |
| 리스크 실현 | 예측 3건 | 실현 2건 / 예측 외 실현 1건 | — |
```

(실제 숫자는 Plan 파싱 + 사용자 입력에서 얻음)

숫자가 없어 추정해야 할 경우 페르소나들이 "확실한 건 체크박스 기반, 나머지는 가정"임을 명시.

**3) Keep (잘한 것) — 각 참석자 1-2개씩**

"다음에도 계속 하고 싶은 것"
- 기술 결정
- 프로세스
- 커뮤니케이션
- 협업 패턴

예:
```
**💻 Kenji (Backend):**
Keep: 스파이크 Task로 AWS SES 프로덕션 승인 절차를 프로젝트 초반에 확인한 것. 
      덕분에 1주 지연으로 끝났지 — 안 했으면 최종 단계에서 발견했을 것.
```

**4) Problem (문제였던 것) — 각 참석자 1-2개씩**

"다음에는 피하고 싶은 것"
- 기술적 이슈
- 일정 오산
- 소통 실패
- 프로세스 누락

**중요**: 블레임 금지, 시스템·프로세스 기반으로만 기술.

예:
```
**🗓️ Iris (Planner):**
Problem: 테스트 작업(T*)이 각 Story 끝에만 몰려서 QA 트랙이 초반 2주 유휴, 
         후반에 과부하. 다음엔 Story마다 테스트 Task를 시작 시점에 함께 계획.
```

**5) Try (다음에 시도할 것) — 합의 기반**

Problem 중 해결 시도 가능한 것을 **구체적 행동**으로 전환.

예:
```
Try 1: Story 생성 시 테스트 Task를 구현 Task와 동시에 스케줄링하는 템플릿 도입
Try 2: 외부 의존성(AWS approve 등)은 프로젝트 시작 1주 내 확인 체크리스트 만들기
Try 3: XL Story가 쪼개진 이후 크기 재검토 (원래 XL이 M 3개로 쪼개졌는데 실제로 L+M+M 이었음)
```

각 Try에는:
- **담당자 후보** (팀 or 역할)
- **완료 확인 방법** (다음 프로젝트에서 어떻게 검증할 건지)

**6) 액션 아이템 정리 (진행자)**

Try를 다음 형태로:

```
## 액션 아이템

| ID | 내용 | 담당 | 완료 확인 | 우선순위 |
|----|------|------|-----------|---------|
| A1 | 테스트 Task 동시 스케줄링 템플릿 | scrum-master | 다음 /plan 결과에서 확인 | High |
| A2 | 외부 의존성 체크리스트 | techlead | 다음 프로젝트 kickoff 전까지 | High |
| A3 | XL 쪼갠 후 재추정 규칙 | scrum-master | scrum-master.md 갱신 | Medium |
```

**7) 클로징 (진행자)**
- 감사 한 마디 (blameless 문화 강조)
- 산출물 파일 경로 안내

### 4L 포맷 (--format=4l 일 때)

Keep/Problem/Try 대신 4개 섹션:
- **Liked** (좋았던 것): 긍정적 경험·순간
- **Learned** (배운 것): 기술·프로세스·팀에 대한 통찰
- **Lacked** (부족했던 것): 자원·정보·지원의 부족
- **Longed For** (아쉬웠던 것): 더 있었으면 하는 것

각 참석자가 1개씩 기여. KPT보다 감정·학습에 초점.

### 발언 규칙

- 형식: `**[이모지] [이름] ([역할]):**`
- 각 발언 3-5문단, 구체적
- **블레임 금지** — 사람이 아니라 시스템·프로세스·도구
- 데이터 인용 권장 ("작성일 기준 45일 경과, 계획 42일이었으니 7% 초과")
- 추측 시 명시 ("체크박스 없는 부분은 추정")

## 5단계: 산출물 작성

`$2` 경로에 다음 형식으로 저장:

```markdown
# 회고: {Plan 제목}

- **회고일**: YYYY-MM-DD
- **대상 Plan**: {Plan 경로}
- **포맷**: KPT | 4L
- **참석자**: {목록}
- **범위**: 완료 부분만 | 전체 (미완 포함)

## 실제 vs 계획 대비

| 항목 | 계획 | 실제 | 차이 |
| ... |

## Keep (잘한 것)                      ← KPT 포맷
- **[담당]**: 내용
- ...

## Problem (문제였던 것)
- **[담당]**: 내용
- ...

## Try (다음에 시도할 것)
- Try 1: ...
  - 담당: 
  - 확인 방법: 
- ...

(또는 4L 포맷일 땐 Liked/Learned/Lacked/Longed For 섹션)

## 액션 아이템

| ID | 내용 | 담당 | 확인 방법 | 우선순위 |
| ... |

## 주요 수치

- 기간: 계획 6주 → 실제 7주 2일 (+22%)
- 크리티컬 패스 지연: 1주 (E2-S1)
- 예측되지 않은 리스크 실현: 1건
- 추가된 Story: 2개

## 반성 없는 사실 기록

(데이터만 기록, 해석 없음 — 다음 프로젝트 킥오프 시 참고용)

## 회의 로그

(전체 회고 대화 발언 순서 보존)
```

## 6단계: 액션 아이템 파일로도 저장 (옵션)

산출물 같은 디렉터리에 `<이름>.actions.md` 생성하여 액션 아이템만 별도:

```markdown
# 액션 아이템: {Plan 이름} 회고

회고 원본: [{회고 파일}]({경로})

| ID | 내용 | 담당 | 확인 방법 | 상태 | 우선순위 |
|----|------|------|-----------|------|---------|
| A1 | ... | ... | ... | [ ] 미완 | High |
| A2 | ... | ... | ... | [ ] 미완 | High |
```

다음 회고 때 이 파일을 먼저 읽어 **이전 Try가 실현됐는지 확인**하는 용도.

## 7단계: 최종 보고

```
✅ 회고 완료

대상 Plan: {$1}
범위: {완료만 or 전체}

Keep {N}건 / Problem {M}건 / Try {K}건
액션 아이템: {A}개 ({High}개 High 우선순위)

산출물:
- 회고: {$2}
- 액션: {$2의 디렉터리}/{파일명}.actions.md

핵심 개선 제안:
- {Try 중 가장 임팩트 높은 1-2개 요약}
```

## 주의사항

- **블레임리스** 원칙 철저히 — 페르소나가 사람을 탓하는 발언을 하면 진행자가 즉시 리프레이밍
- 데이터가 부족하면 **추정임을 명시**, 없는 걸 지어내지 않음
- 한 응답 안에서 전체 회고 끝 — 중간에 "계속할까요?" 묻지 마라
- 산출물 디렉터리 없으면 `mkdir -p`
- 참석자 명단에 없는 페르소나 언급 금지
- Try는 **구체적 행동**으로 (모호한 "더 잘 소통하자" 금지)
- 액션 아이템은 **담당자와 확인 방법** 반드시 포함
