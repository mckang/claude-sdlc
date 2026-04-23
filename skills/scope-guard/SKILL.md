---
name: sdlc-scope-guard
description: Use during story implementation when file changes extend beyond the story's AC scope, unplanned refactoring appears, or modules unrelated to the current story are being modified
---

# 범위 이탈 감지 (Scope Guard)

Story 구현 중 AC 범위를 벗어난 변경이 감지되면 **즉시 멈추고** 이 skill을 적용한다.

## 범위 이탈 신호

다음 중 하나라도 해당하면 이탈:

- 변경 파일이 현재 Story의 AC·DoD에 언급되지 않은 모듈
- "겸사겸사" 리팩토링 (Story와 무관한 네이밍·구조 개선)
- 다른 Story·Epic의 Task 선취 구현
- 새 의존성 추가 (Plan에 미기재)
- 설계 문서(PRD·아키텍처)에 없는 기능 추가

## 감지 시 처리 절차

### 1. 즉시 중단

현재 변경을 commit하지 않는다. 작업 중인 파일 목록과 이탈 사유를 출력:

```
⚠️ 범위 이탈 감지 — <STORY_ID>

현재 Story AC:
  - AC-1: ...
  - AC-2: ...

이탈 변경:
  - src/utils/formatter.ts — Story AC와 무관한 리팩토링
  - src/models/user.ts — E3-S2 Task 선취

선택:
  (a) 이탈 변경 되돌리고 Story 범위만 계속 구현
  (b) 이탈 변경을 별도 커밋으로 분리 (scope-change 등록 후)
  (c) 이탈이 AC 달성에 필수임을 확인 → Plan에 Task 추가 후 계속
  (d) 중단 (수동 정리)
```

### 2. 사용자 응답 처리

- **(a)**: `git checkout -- <이탈 파일>` 후 Story 구현 재개
- **(b)**: 이탈 변경만 먼저 커밋 (`chore` 또는 `refactor` 타입) → `/sdlc:scope-change` 실행 권고 → Story 계속
- **(c)**: Plan의 해당 Story Task에 추가 항목 기록 → 계속
- **(d)**: 브랜치 유지, 사용자 수동 정리

### 3. 로그 기록

`${CLAUDE_PROJECT_DIR}/docs/plans/<NAME>/<STORY_ID>/kickoff.md` 의 "⚠️ 확인 필요 사항" 또는 별도 메모로 이탈 사유와 처리 결과를 1줄 기록.

## 자동 감지 힌트

Story 구현 중 아래 상황이 오면 스스로 체크:

- `git diff --name-only` 목록이 AC에서 언급된 파일 외 3개 이상 넘어갈 때
- 리팩토링 커밋 메시지를 작성하려 할 때
- `package.json` / `build.gradle` 등 의존성 파일을 수정하려 할 때
