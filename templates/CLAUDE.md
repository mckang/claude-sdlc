# SDLC Plugin Rules

이 프로젝트는 `sdlc` Claude Code 플러그인을 사용한다. Claude 는 아래 규칙을 **자동으로** 준수한다.

## 1. 맥락 로딩 (세션 시작 시)
프로젝트 작업을 시작할 때 반드시 다음을 먼저 읽는다:
- `docs/plans/<현재 feature>.md` — 현재 Plan
- `docs/prd/<feature>.md` — 요구사항
- `docs/architecture/<feature>.md` — 설계
- `docs/standards/` — 스택 관련 표준

## 2. Story 단위 작업
개발은 Story 단위로. `/sdlc:story start` → 사용자 승인 → 구현 → `/sdlc:story verify` → `/sdlc:story complete`.

## 3. 구현 중 금지
- 표준 위반 (금지 사항 준수)
- 설계 외 기능 "겸사겸사" 추가
- 테스트 느슨하게 만들기
- XL Story 그대로 구현

## 4. 결정 지점
임의 판단 금지. 중단하고 사용자 문의 또는 `/sdlc:meeting` 제안.

## 5. Plan 갱신
Task 상태는 즉시 체크박스로: `[ ]` `[~]` `[!]` `[x]`.

## 6. 스코프 변경
변경 발생 시 반드시 `/sdlc:scope-change` 실행. 원본 보존·이력 추적.

## 7. 스탠드업·회고
- 매일 아침 `/sdlc:standup` 권장
- 프로젝트 완료 시 `/sdlc:retrospective` 필수

## 8. PR
Story 완료 시 `/sdlc:pr` 로 본문 생성. 기본은 `--no-push` (사용자 검토 후 수동 푸시).

## 9. 테스트·보안
- 모든 Story에 테스트 필수 (AC 커버)
- 비밀정보 로그 금지
- 표준의 "금지 사항" 자동 감지

## 10. 세션 재개
새 세션 시 `/sdlc:status` 로 파악 후 이어받기.

---

## 빠른 명령 참조

```
/sdlc:init                                         # 최초 1회
/sdlc:plan <PRD> <Arch> <Plan>                     # Epic→Story→Task 분해
/sdlc:story start|verify|complete <ID> <Plan>      # Story 사이클
/sdlc:meeting <참석자> | <주제> | <산출물>         # 토론
/sdlc:standup <Plan>                               # 스탠드업
/sdlc:status <Plan> [--update]                     # 진행 상황
/sdlc:pr <StoryID> <Plan> [--draft|--no-push]      # PR
/sdlc:scope-change <Plan> [사유]                   # 스코프 변경
/sdlc:plan-review <Plan> <산출물>                  # Plan 리뷰
/sdlc:retrospective <Plan> <산출물> [--format=...] # 회고
/sdlc:onboard [--role=...] [--feature=...]        # 온보딩
/sdlc:roles                                        # 페르소나 목록
```
