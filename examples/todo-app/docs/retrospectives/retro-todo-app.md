---
feature: todo-app
format: kpt
date: 2026-04-23
facilitator: Nick
saved_at: 2026-04-23T14:30:00
---

# Retrospective — Feature: todo-app (KPT)

**진행자**: 🎩 Nick (facilitator)
**참석자 (7+1)**: Nick · Steve (scrum-master) · Natasha (planner) · T'Challa (PM) · Tony (architect) · Peter (frontend) · Clint (QA) · Rhodes (techlead, 옵저버)
**참조 Plan**: [../plans/plan-todo-app.md](../plans/plan-todo-app.md)
**Deps**: [../plans/plan-todo-app.deps.md](../plans/plan-todo-app.deps.md)

> **맥락**: 이 feature 는 단순 결과물이 아니라 **플러그인 자체의 품질을 검증하는 dogfooding**. 방법론 쪽 개선 힌트를 찾는 게 1차 목적.

---

## 📊 계획 vs 실제

| 항목 | 계획 | 실제 | 차이 |
|---|---|---|---|
| Epic | 2 | 2 | 0 |
| Story | 5 | 5 (전량 완료) | 0 |
| Task | 18 | 18 | 0 |
| 기간 | 0.5주 (예제 규모) | 약 4h 실작업 | 규모상 의미 없음 |
| 마일스톤 | M1·M2 | M1·M2 달성 | 0 |
| XL Story | 0 | 0 | — |
| **AC 소급 추가** | 0 | **2건** | **+2 ⚠️** |
| 테스트 커버리지 | 0 (의도적) | 0 | 0 (반대 의견 보존) |
| Lighthouse Performance | ≥ 90 | 96 | +6 ✅ |
| First Load JS | ≤ 100 kB | 89.2 kB | −10.8 kB ✅ |

---

## 🟢 Keep

### Steve (scrum-master)
**"반대 의견 보존" 섹션이 retro 에서 실제로 재검토 트리거로 작동했다.** Tony 의 "테스트 없이 내보내는 게 표준 위반" 코멘트가 Plan 에 남아 있어 지금 이 회고에서 "다음 버전에 넣나 안 넣나" 를 결정할 수 있었다. 이 메커니즘 없었으면 조용히 묻혔을 것.

### Natasha (planner)
**T-shirt size 추정이 전량 정확.** XL 없음, 편차 0. v1.6.2 에서 재조정된 크기 기준 (S = 4h–1일 PR) 이 현장에서 작동함을 확인.

### Clint (QA)
**DoD 수동 검증이 의미 있게 작동.** E2-S2 의 DoD 에 "Lighthouse Perf ≥ 90" 이 명시돼 있어 측정·기록이 자연스럽게 일어났고 결과가 PRD NFR 에 역참조됐다. DoD 가 의례적 문구였으면 생략됐을 것.

### T'Challa (PM)
**feature → PRD → architecture → plan 의 정보 축적이 매끄러웠음.** PRD 의 AC-A~D 가 Plan 의 Story AC 로 확장됐고, 아키텍처 §7 "구현 순서 제안" 이 Plan 의 크리티컬 패스로 재사용됨. 단계 간 retype 없음.

---

## 🔴 Problem (블레임리스 — 사람 아닌 시스템 기준)

### Peter (frontend) — AC 소급 추가 2건
- E2-S1: "필터 결과 0건일 때 안내 문구" — PRD·Plan 어디에도 없었음
- E2-S2: "빈 상태에서 필터·푸터 숨김" — 역시 명시 없음

**진단**: PRD 가 성공 경로 AC 는 잘 다루지만 **edge case (빈 결과·경계값·상태 조합)** 을 구조화된 질의로 묻지 않음. 구현 들어가서야 UX 상 필요가 드러남. 프로세스 갭.

### Tony (architect) — 원칙 vs 테크닉 갭
아키텍처 §6 가 "SSR 충돌 → `'use client'` + `useEffect`" 까지만 기재했는데, 실제 구현에선 `loadedRef.current` 로 **"mount 후에만 save"** 패턴이 필수였음 (없으면 초기 빈 배열이 localStorage 덮어씀). 아키텍처가 "원칙" 레벨에서 멈추고 **"구현 테크닉"** 레벨로 내려가지 않음. 레퍼런스 예제라는 점에서 특히 치명적.

### Rhodes (techlead) — "반대 의견 보존" 의 미해결 리스크
Steve 가 Keep 에서 칭찬한 메커니즘이 동시에 Problem: **보존만 되고 해결 경로가 없으면 영구 보류와 구분 불가.** 이 예제가 학습 레퍼런스인데 테스트 없음이 "테스트는 선택" 이라는 잘못된 시그널을 초심자에게 줌.

### Clint (QA) — 테스트 부재의 구체 비용
E1-S3 AC-3 (깨진 JSON fallback) 검증이 **"DevTools → Application → Local Storage → 수동 손상 → 새로고침 → warn 확인"** 이라는 5-step 수동 절차. 재현 가능성 낮고 regression 감지 불가.

---

## 🟡 Try → Action

| ID | Try | 담당 | 확인 방법 | 우선순위 |
|----|-----|------|-----------|----------|
| A1 | PRD 단계에 **"Edge Case 체크리스트"** 서브섹션 추가 (빈상태·경계값·단일항목·초대량·실패경로·권한실패·0건 결과) | Steve + T'Challa | `commands/prd.md` 또는 PRD 템플릿에 섹션 추가된 commit | 🔴 High |
| A2 | Architecture 커맨드·템플릿에 **"구현 테크닉" 서브섹션** 유도 가이드 (SSR+localStorage → loadedRef 등 예시 포함) | Tony | `commands/architecture.md` 가이드 문구 추가 commit | 🟡 Medium |
| A3 | `examples/todo-app` 에 vitest + React Testing Library 기반 단위 테스트 v2 추가 (또는 별도 예제) | Peter + Clint | 테스트 green + v1.7.0 릴리스 노트 | 🟢 Low (v1.7.0) |
| A4 | Plan 템플릿 **"반대 의견 보존"** 항목에 `resolved_by: v1.x.x / retro / out_of_scope` 필드 규약 추가 | Steve | `templates/reports/plan/plan.md` 수정 commit | 🟡 Medium |

---

## 🎯 Key Metrics

- **완료율**: 100% (5/5 Story)
- **Sizing 정확도**: 100% (편차 0)
- **DoD 달성률**: 100%
- **AC 소급 추가**: 2건 (→ 개선 대상)
- **NFR**: Lighthouse Perf 96 · First Load JS 89.2 kB (NFR 이내)

---

## 🧪 회의 로그

1. **Nick (오프닝)**: dogfooding 맥락 선언 — 결과 자체보다 방법론 개선 힌트 수집 우선
2. **Steve (Keep)**: 반대 의견 보존 메커니즘 극찬
3. **Natasha (Keep)**: sizing 기준 재조정(v1.6.2) 의 현장 효과 확인
4. **Clint (Keep)**: DoD 의 측정 가능 항목(Lighthouse) 이 retro-loop 완성
5. **T'Challa (Keep)**: 단계 간 정보 축적의 매끄러움
6. **Peter (Problem)**: AC 소급 추가 2건 — PRD edge case 질의 부재
7. **Tony (Problem)**: 원칙→테크닉 갭 — `loadedRef` 같은 구체 패턴 누락
8. **Rhodes (Problem)**: 반대 의견 보존의 미해결 리스크 (→ Try A4 로 수렴)
9. **Clint (Problem)**: 테스트 부재의 구체 비용 (수동 5-step · regression 감지 불가)
10. **Nick (마무리)**: Problem → Try 4건 → Action Item 4건, 담당·확인 방법 할당

---

## 다음 retro 때 체크할 것

- A1~A4 의 실제 이행 여부
- 이행된 A1 (Edge Case 체크리스트) 이 다른 feature 에서 AC 소급 추가 건수를 줄였는지 정량 비교
- A3 (vitest 추가) 가 plan 의 "반대 의견 보존" 항목을 `resolved_by: v1.7.0` 으로 종결시켰는지 확인
