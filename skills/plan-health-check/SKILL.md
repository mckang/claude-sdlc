---
name: sdlc-plan-health-check
description: Use when a plan file is modified, before running /sdlc:plan-review, or when /sdlc:status shows unexpected results — automatically detects structural issues in plan and deps files
---

# Plan 파일 정합성 검사

Plan 파일 자동 분석. 사용자에게 묻지 않고 단독으로 실행한다.

## 입력

대화 맥락에서 Plan 파일 파악. 없으면 current feature의 plan resolve.

## 검사 항목

### 1. 체크박스 정합성

```bash
# Story 헤더가 <!-- 상태: done --> 인데 Task에 미완료([ ] 또는 [~]) 있으면 불일치
grep -n "상태: done" "$PLAN"
grep -n "- \[ \]\|- \[~\]" "$PLAN"
```

불일치 발견 시: `⚠️ [E1-S2] 상태: done 이지만 미완료 Task N개`

### 2. 스냅샷 vs 실제 카운트

Plan 상단 "📊 최근 상태 스냅샷" 의 Story/Task 숫자와 체크박스 실제 집계가 다르면:

`⚠️ 스냅샷 불일치 — Story: 스냅샷 14/33 vs 실제 16/33 (+2). /sdlc:status --update 권장`

### 3. deps.md 순환 의존 탐지

`<plan>.deps.md` 있으면 `Read` 후 Mermaid 엣지 추출:

```
E1S1 --> E1S2  # 하드 의존
E1S3 -.-> E1S4 # 소프트 의존
```

**Kahn's algorithm** 으로 위상 정렬 → 사이클 감지:

`❌ 순환 의존 발견: E2S3 → E2S4 → E2S3. deps.md 수정 필요`

### 4. 고아 Story 탐지

Plan 본문에 있는 Story ID가 deps.md 노드에 없거나, deps.md 노드가 Plan에 없으면:

`⚠️ 고아 노드: deps.md의 E3S5가 Plan에 없음`

### 5. XL Story 탐지

Task 7개 초과이거나 크기가 XL인 Story:

`⚠️ XL Story: E2-S3 (Task 9개) — /sdlc:plan-review 에서 재분해 권고`

## 출력 형식

```
🔍 Plan Health Check: plan-checkout-v2.md

✅ 통과 (3): 체크박스 정합성·스냅샷·고아노드 없음
⚠️ 경고 (2):
  - 스냅샷 불일치: Story 14/33 vs 실제 16/33
  - XL Story: E2-S3 (Task 9개)
❌ 오류 (1):
  - 순환 의존: E2S3 → E2S4 → E2S3

권고: /sdlc:status --update 실행 후 deps.md E2S3·E2S4 관계 확인
```

오류 없으면: `✅ Plan Health Check 통과 — 구조적 이상 없음`
