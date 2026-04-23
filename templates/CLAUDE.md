# SDLC Plugin Rules

이 프로젝트는 `sdlc` Claude Code 플러그인을 사용한다. Claude 는 아래 규칙을 **자동으로** 준수한다.

## 1. 맥락 로딩 (세션 시작 시)
프로젝트 작업을 시작할 때 반드시 다음을 먼저 읽는다:
- `CLAUDE.md` 의 `## Current Feature` 섹션 — 현재 작업 중인 feature 이름 (`<name>`)
- `docs/plans/plan-<name>.md` — 현재 Plan
- `docs/prd/prd-<name>.md` — 요구사항
- `docs/architecture/architecture-<name>.md` — 설계
- `docs/features/feature-<name>.md` — 최초 아이디어
- `docs/standards/` — 스택 관련 표준

## 2. Story 단위 작업
개발은 Story 단위로. `/sdlc:story start` → 사용자 승인 → 구현 → `/sdlc:story verify` → `/sdlc:story complete`.
각 단계 보고서는 `docs/plans/<feature>/<Story-ID>/{kickoff,verify,complete}.md` 로 자동 저장된다.

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
- 프로젝트 완료 시 `sdlc-retrospective` skill (Claude 자동 제안)

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
/sdlc:feature <이름>                                # 대화로 feature 수집 + current 등록
/sdlc:feature --push <이름>                         # 현재 current 를 스택에 밀고 새 feature (핫픽스 등)
/sdlc:feature --pop | --list | --drop <이름>        # 스택 조작
/sdlc:prd [이름]                                    # feature → 공식 PRD (생략 시 current)
/sdlc:architecture [이름]                           # PRD → 아키텍처 (생략 시 current)
/sdlc:plan [이름 또는 <PRD> <Arch> <Plan>]          # Epic→Story→Task 분해
/sdlc:story start|verify|complete <ID> [이름|Plan] # Story 사이클
/sdlc:meeting <참석자> | <주제> | <산출물>         # 범용 토론
/sdlc:standup [이름|Plan]                           # 스탠드업
/sdlc:status [이름|Plan] [--update]                 # 진행 상황
/sdlc:pr <StoryID> [이름|Plan] [--draft|--no-push]  # PR
/sdlc:scope-change [이름|Plan] [사유]               # 스코프 변경
sdlc-plan-review skill                             # Plan 리뷰 (Claude 자동 제안)
sdlc-retrospective skill [--format=kpt|4l]         # 회고 (Claude 자동 제안)
/sdlc:onboard [--role=...] [--feature=...]          # 온보딩
페르소나 목록 — sdlc-roles skill (Claude 자동 참조)
```

산출물 파일명 규약: `docs/<type>/<type>-<name>.md`
Current Feature 는 `/sdlc:feature` 가 CLAUDE.md 의 `## Current Feature` 섹션에 등록한다.
**Feature Stack** 은 `## Feature Stack` 섹션에 저장되며, push/pop 으로 동시에 2개 이상의 feature 를 오갈 수 있다 (핫픽스 끼워넣기 등). 후속 커맨드는 항상 **top 이 아닌 Current** 를 참조한다.

---

## 프로젝트 오너
- **이름**: {NAME}
- **역할**: 최종 의사결정자. 미팅·토론 중 결정이 필요하면 반드시 이 사용자에게 질의.
