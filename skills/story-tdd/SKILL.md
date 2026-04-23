---
name: sdlc-story-tdd
description: Use when a story or task is marked with "TDD 의무" in the plan, before writing any implementation code for that story — enforces Red-Green-Refactor cycle
---

# Story TDD 의무 (Red-Green-Refactor)

Plan에서 Story 또는 Task에 **"TDD 의무"** 문구가 있으면 이 skill을 적용한다.
구현 코드 작성 전 반드시 이 순서를 따른다.

## Red-Green-Refactor 사이클

### 🔴 Red — 실패하는 테스트 먼저

1. AC를 테스트 코드로 번역한다 (AC 한 항목 = 테스트 한 케이스)
2. 테스트 실행 → **반드시 실패**해야 정상
3. 실패 로그 확인 (`AssertionError`, `NotFound` 등)

```
Red 확인: 테스트가 실패하지 않으면 테스트 자체가 잘못된 것.
          구현 코드 작성 전 실패를 눈으로 확인한다.
```

### 🟢 Green — 통과시키는 최소 코드

4. 테스트를 통과시키는 **최소한의** 코드만 작성
5. 우아함·최적화·재사용성 고려 금지 (Refactor 단계에서 처리)
6. 테스트 재실행 → 통과 확인

### 🔵 Refactor — 동작 유지하며 정리

7. 중복 제거·네이밍 개선·구조 정리
8. 테스트는 계속 통과해야 함
9. 리팩토링 완료 후 다음 AC로 이동 (1번부터 반복)

## 커밋 패턴

```
test(<scope>): <STORY_ID> <AC 설명> — failing test
feat(<scope>): <STORY_ID> <AC 설명> — make test pass
refactor(<scope>): <STORY_ID> clean up <모듈명>
```

## 금지 사항

| 금지 | 이유 |
|------|------|
| 구현 코드 먼저 작성 | TDD 의무 위반 |
| "나중에 테스트 추가" | Red 단계를 보지 않으면 테스트가 제대로 검증하는지 알 수 없음 |
| 테스트 없이 Green 선언 | AC 달성 여부 불명 |
| 여러 AC를 한 번에 구현 | 사이클 당 AC 1개 |

## 체크리스트 (각 AC마다)

- [ ] 테스트 코드 작성 완료
- [ ] 실패 확인 (Red)
- [ ] 최소 구현으로 통과 (Green)
- [ ] 리팩토링 후 통과 유지 (Refactor)
- [ ] 커밋 분리 완료
