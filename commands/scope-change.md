---
argument-hint: [Plan파일|feature이름, 생략 시 current] [변경사유]
description: Plan의 스코프 변경을 공식 기록 (원본 보존 + 변경 이력 + 영향 분석)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 스코프 변경 기록

사용자가 `/scope-change [Plan|feature이름] [사유]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:scope-change                                                   # current feature 사용
/sdlc:scope-change "SMS 인증 추가 요청"                                # current + 사유
/sdlc:scope-change checkout-v2 "M2 에 SMS 인증 추가"             # 이름 + 사유
/sdlc:scope-change docs/plans/plan-x.md "사유"                         # 명시 경로
```

스코프 변경은 자주 일어나고 추적 안 되면 나중에 "왜 이렇게 됐지?" 하게 됨.
이 명령은 **변경 이력을 구조화**하고 **영향받는 Story·일정을 자동 분석**해서 기록.

## 1단계: 인자 파싱

- `$1`: Plan 파일 경로, feature 이름, 또는 변경 사유 (선택)
- `$2`: 변경 사유 (선택)

### Plan 경로 및 사유 분리

첫 인자가 Plan 지시자(파일 경로 또는 kebab-case 이름) 면 `$2` 가 사유.
그렇지 않으면 `$1` 전체를 사유로 쓰고 Plan 은 current feature 로 resolve.

```bash
ARG1="${1:-}"
ARG2="${2:-}"

is_kebab_name() {
  [[ "$1" =~ ^[a-z0-9][a-z0-9-]*$ ]]
}

if [ -z "$ARG1" ]; then
  PLAN_ARG=""; REASON=""
elif [ -f "$ARG1" ] || is_kebab_name "$ARG1"; then
  PLAN_ARG="$ARG1"; REASON="$ARG2"
else
  PLAN_ARG=""; REASON="$ARG1"
fi

OUT=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-plan-path.sh" "$PLAN_ARG") || exit 1
NAME=$(sed -n 1p <<<"$OUT")
PLAN=$(sed -n 2p <<<"$OUT")
test -f "$PLAN" || { echo "❌ Plan 파일 없음: $PLAN"; exit 1; }
```

## 2단계: 변경 수집 (사용자 인터랙티브)

사용자에게 다음을 단계별로 물어본다:

### 2-1. 변경 유형

```
어떤 유형의 스코프 변경인가요?

(a) 추가 (Add) — 새 Story·Epic·기능 추가
(b) 삭제 (Remove) — 기존 Story·기능 제거
(c) 변경 (Change) — 기존 Story의 요구사항·AC 변경
(d) 연기 (Defer) — 다음 릴리스로 미룸
(e) 우선순위 조정 (Reprioritize) — 기존 Story 순서만 변경
```

### 2-2. 변경 내용 구체화

유형에 따라 다른 질문:

**추가**:
- 추가할 것은 Story인가 Epic인가?
- 제목·설명을 알려주세요
- 어느 Epic에 속하나요?
- 예상 크기?

**삭제**:
- 삭제할 Story/Epic ID는?
- 완료된 Task가 있으면 어떻게 처리? (롤백? 그대로 두기?)

**변경**:
- 대상 Story ID?
- 무엇이 바뀌나요? (AC / 크기 / 의존성 / 기타)

**연기**:
- 연기할 Story/Epic ID?
- 언제로? (다음 릴리스·미정·특정 마일스톤)

**우선순위 조정**:
- 새 순서를 알려주세요

### 2-3. 변경 사유 (기록용)

이미 `$REASON` 으로 제공됐으면 생략, 없으면:
```
이 변경의 비즈니스 사유는 무엇인가요? 
(나중에 "왜 이렇게 됐지?" 추적하는 데 사용)
```

### 2-4. 승인자·영향도

```
- 이 변경을 누가 승인했나요? (또는 누구 요청?)
- 긴급도: 🔴 긴급 / 🟡 중요 / 🟢 일반
```

## 3단계: 영향 분석 (자동)

Plan 파일과 `.deps.md` 를 읽고 영향 자동 계산:

### 3-1. 직접 영향받는 Story

변경 대상 Story와 **의존 관계가 있는 모든 Story**:
- 하드 블로킹: 직접 재작업 필요
- 소프트 의존: 일부 수정 필요
- 독립: 영향 없음

### 3-2. 마일스톤 영향

변경된 Story가 속한 마일스톤의 달성 여부:
- 크기 증가 → 마일스톤 지연 가능
- 크기 감소 → 여유 발생

### 3-3. 크리티컬 패스 변화

- 추가된 Story가 크리티컬 패스에 들어가는지
- 삭제로 크리티컬 패스가 바뀌는지

### 3-4. 예상 일정 변화

T-shirt size 합산:
- 이전: M × 10 + L × 8 = 78점
- 이후: M × 11 + L × 8 = 81점 (+3점 ≈ +1.5일)

## 4단계: 변경 전 Plan 백업

중요 — 원본 보존.

`${CLAUDE_PROJECT_DIR}/docs/plans/archive/<원본파일명>-<YYYYMMDD-HHMM>.md` 로 복사:

```bash
mkdir -p ${CLAUDE_PROJECT_DIR}/docs/plans/archive
cp ${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.md ${CLAUDE_PROJECT_DIR}/docs/plans/archive/plan-checkout-v2-20260421-1430.md
```

## 5단계: Plan 수정

변경 유형에 따라:

**추가**:
- 해당 Epic 섹션에 새 Story 삽입
- Task 목록 추가
- 의존성 파일(`.deps.md`) 에도 노드 추가

**삭제**:
- Story를 "~~삭제됨~~" 으로 스트라이크 표시 (완전 삭제 X — 이력 보존)
- 또는 `<!-- DELETED: 이유 -->` 주석
- 의존성에서도 제거, 연결된 화살표 조정

**변경**:
- 해당 Story 섹션 수정
- 변경 전/후를 주석으로 남김:
  ```markdown
  <!-- CHANGED on 2026-04-21: AC-3 수정. 이전: "5초" → 현재: "3초". 사유: 사용자 피드백 -->
  ```

**연기**:
- Story 제목에 `[연기됨: 2026 Q3]` 표시
- 별도 섹션 "## 📅 연기된 항목" 으로 이동 (또는 별도 Plan 파일)

**우선순위 조정**:
- 마일스톤 표·Story 순서 재배치
- 의존성 그래프 갱신

### 모든 경우 공통

Plan 상단에 "## 🔄 변경 이력" 섹션이 없으면 생성, 있으면 맨 위에 추가:

```markdown
## 🔄 변경 이력

### 2026-04-21 14:30 — Change #3
- **유형**: 추가 (Add)
- **내용**: E2 Epic 하위에 `E2-S4: SMS 인증` 추가
- **사유**: 보안팀 요청, GDPR 대비 2FA 필요
- **승인**: John (PM)
- **긴급도**: 🟡 중요
- **영향**:
  - 직접 영향 Story: E2-S1, E2-S2 (발송 트랙에 병렬 추가)
  - 마일스톤: M2 목표 +1주 지연 (주 4 → 주 5)
  - 크리티컬 패스: 변경 없음 (SMS는 병렬)
  - 예상 공수: +M (3일)
- **원본 백업**: [archive/plan-checkout-v2-20260421-1430.md](archive/plan-checkout-v2-20260421-1430.md)

### 2026-04-15 10:00 — Change #2
- ...

### 2026-04-10 16:00 — Change #1
- ...
```

## 6단계: 의존성 파일 업데이트

`.deps.md` 가 있으면 mermaid 다이어그램 갱신:
- 새 노드 추가
- 화살표 조정
- 크리티컬 패스 색상 재적용

## 7단계: 별도 변경 리포트 파일 저장

`${CLAUDE_PROJECT_DIR}/docs/plans/scope-changes/<Plan>-<번호>.md` 에 변경 상세 저장:

```markdown
# Scope Change #3: SMS 인증 추가

- **날짜**: 2026-04-21 14:30
- **Plan**: ${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.md
- **유형**: 추가
- **긴급도**: 🟡 중요

## 배경
(사용자 입력한 사유 전문)

## 변경 상세
- 추가: E2-S4 "SMS 인증 메시지 발송"
  - Task: E2-S4-T1 (Twilio 통합), E2-S4-T2 (UI 추가)
  - 크기: M

## 영향 분석
{자동 분석 결과 전문}

## 대안 검토
(검토된 다른 옵션)
- 옵션 A: 이메일 OTP 강화만 → 거절 사유: ...
- 옵션 B: 외부 2FA 서비스 (Authy) → 거절 사유: 비용

## 승인 이력
- 요청: Compliance (Noor)
- 승인: PM (John)
- 통지: Dev team 전체

## 후속 작업
- [ ] Twilio 계정·키 준비
- [ ] Legal 검토 (SMS 수집 동의)
- [ ] E2-S1 (기존 이메일 발송)과의 조정

## 관련 링크
- 원본 Plan 백업: [archive/plan-checkout-v2-20260421-1430.md](../archive/plan-checkout-v2-20260421-1430.md)
- 요청 meeting: [${CLAUDE_PROJECT_DIR}/docs/meetings/sms-2fa-request.md](../../meetings/sms-2fa-request.md)
- 의존성 그래프 갱신: [plan-checkout-v2.deps.md](../plan-checkout-v2.deps.md)
```

## 8단계: Plan 상단 스냅샷 업데이트

`/status --update` 동등 동작 자동 실행.

변경으로 진행률·블로커가 바뀌면 반영.

## 9단계: 최종 보고

```
✅ 스코프 변경 기록 완료

Change #3 (2026-04-21)
- 유형: 추가
- 내용: E2-S4 SMS 인증 추가 (크기 M)
- 사유: 보안팀 요청 (GDPR 2FA)

영향:
- 직접 영향: 2개 Story
- 마일스톤 M2: +1주 지연 예상 (주 4 → 주 5)
- 크리티컬 패스: 변경 없음 (병렬)
- 예상 공수: +M (3일)

백업: ${CLAUDE_PROJECT_DIR}/docs/plans/archive/plan-checkout-v2-20260421-1430.md
상세 리포트: ${CLAUDE_PROJECT_DIR}/docs/plans/scope-changes/plan-checkout-v2-003.md

다음 단계 제안:
1. 영향받는 팀에 공지 (Slack·이메일)
2. /meeting pm, security, backend | SMS 구현 방식 논의 | ...
3. 다음 스탠드업(/standup)에서 스코프 변경 언급
```

## 주의사항

- **원본 Plan 백업 필수** — 백업 실패 시 변경 진행 금지
- **모든 변경은 이력에 남음** — 완전 삭제 금지 (strike through 또는 주석)
- **사유 없는 변경 거부** — 사용자에게 사유 요청
- **승인자 없는 변경 경고** — "승인자가 누구인지 확실하지 않다"고 기록
- 영향 분석은 **자동이지만 완벽 아님** — 사용자 검토 권장

## 특수 상황

### 완료된 Story 변경
- 이미 `[x]` 인 Story 변경 시 경고:
  > "E1-S1은 이미 완료됐습니다. 변경은 **새 Story 생성**을 권장합니다."

### 진행중 Story 삭제
- `[~]` 인 Story 삭제 시:
  > "진행 중인 작업이 있습니다. 작업 손실 방지를 위해:
  > (a) 먼저 완료 후 결정
  > (b) 중단·롤백 (담당자 확인 필요)
  > (c) 강제 삭제 (위험)"

### 연쇄 변경
- 변경된 Story가 다른 Story에 블로킹 관계면, 그 Story들도 재검토 필요 안내

## 에러 처리

- Plan 파일 없음 → 중단
- `.deps.md` 없음 → 경고만, 수동 영향 분석 요청
- 변경 유형 불명 → 사용자에게 다시 물음
- 백업 실패 (권한·공간) → **변경 중단** (원본 보존 최우선)

## 팁

- 변경이 자주 일어나면 **회고 주제로 다룸**: "왜 스코프가 자주 바뀌나? 초기 분석 부족인가?"
- 긴급도 🔴 변경이 반복되면 요구사항 프로세스 자체 개선 필요
- 변경 #1, #2, #3... 누적은 **프로젝트 건강도 지표**
