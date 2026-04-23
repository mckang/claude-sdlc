---
feature: todo-app
retro_date: 2026-04-23
source: retro-todo-app.md
---

# Action Items — todo-app retrospective

> 다음 회고 시 이 파일을 먼저 열어 이행 여부를 확인한다. 종결된 항목은 체크 + `resolved_by` 주석.

## 진행 상태

| ID | 내용 | 담당 | 확인 방법 | 우선순위 | 상태 | 종결 근거 |
|----|------|------|-----------|----------|------|-----------|
| A1 | PRD 단계에 **Edge Case 체크리스트** 서브섹션 추가 | Steve + T'Challa | `commands/prd.md` 또는 PRD 템플릿에 섹션 추가된 commit | 🔴 High | ✅ done | v1.7.0 — `commands/prd.md` Round 3.5 + 템플릿 "엣지 케이스" 섹션 추가 |
| A2 | Architecture 커맨드·템플릿에 **구현 테크닉 서브섹션** 유도 가이드 추가 | Tony | `commands/architecture.md` 가이드 문구 추가 commit | 🟡 Medium | ✅ done | v1.7.0 — `commands/architecture.md` Round 4.5 + 템플릿 "구현 테크닉 · 패턴" 섹션 추가 |
| A3 | `examples/todo-app` 에 vitest 기반 단위 테스트 v2 추가 | Peter + Clint | 테스트 green + v1.7.0 릴리스 노트 기재 | 🟢 Low | ✅ done | v1.7.0 — `lib/storage.test.ts` 7건 + `lib/use-todos.test.ts` 9건 = 16 tests green |
| A4 | Plan 템플릿 "반대 의견 보존" 에 `resolved_by` 필드 규약 추가 | Steve | `templates/reports/plan/plan.md` 수정 commit | 🟡 Medium | ✅ done | v1.7.0 — YAML 블록 규약 + `resolved_by` 값 (open/retro-YYYY-MM-DD/v semver/out_of_scope) 정의 |

## 이전 retro 에서 이월된 항목

없음 (이번이 첫 회고).

## 다음 retro 체크포인트

- 각 항목의 `상태` 를 `✅ done` + `종결 근거` 에 commit hash 또는 버전 기입
- 미이행된 항목은 사유 기재 + 우선순위 재조정 또는 폐기 결정
- 이행된 A1 이 실제로 다른 feature 의 AC 소급 추가를 줄였는지 정량 비교
