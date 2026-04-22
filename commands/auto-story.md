---
argument-hint: [Story ID] [Plan파일|feature이름, 생략 시 current] [--no-merge] [--interactive]
description: Story 의 start·verify·complete·로컬 머지를 한 번에 실행 (필요 시에만 사용자 확인)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Auto-Story — 한 번에 끝까지

`/sdlc:story` 의 3 단계 (start · verify · complete) + 로컬 머지를 자동으로 연속 실행하는 wrapper.
**기본 동작은 자동 진행**, 사용자 판단이 꼭 필요한 지점에서만 멈춰서 묻는다.

전체 인자: `$ARGUMENTS`

## 호출 예시

```
/sdlc:auto-story E3-S4                              # 컨벤션의 plan 사용, 자동 진행
/sdlc:auto-story E4-S1 --no-merge                   # 머지는 사용자가 수동으로
/sdlc:auto-story E5-S1a --interactive               # 매 단계 확인 (= /story 와 동일 톤)
/sdlc:auto-story E1-S1 docs/plans/plan-checkout-v2.md   # Plan 명시 오버라이드
/sdlc:auto-story E1-S1 checkout-v2                  # feature 이름으로 plan resolve
```

## 0 단계: 프로젝트 기본값 로드

`/sdlc:story` 와 동일한 방식으로 `${CLAUDE_PROJECT_DIR}/CLAUDE.md` 의
`## 프로젝트 컨벤션 (커맨드 기본값)` yaml 블록을 참조한다.
사용하는 키도 동일:

- `plan`, `plan_deps`
- `branch.main` (default `main`), `branch.story_prefix` (default `story/`)
- `test.coverage_command`, `lint.command`
- `standards.*`

컨벤션 블록이 없으면 default 값으로 계속 진행.

## 1 단계: 인자 파싱

- `$1`: Story ID (필수, 예: `E1-S1`)
- `$2` (선택, 위치 무관): Plan 경로 또는 feature 이름 (미지정 시 Current Feature resolve — `/sdlc:story` 와 동일 로직)
- 플래그 (위치 무관):
  - `--no-merge` — 4 단계(머지) skip, 브랜치만 남김
  - `--interactive` — 모든 단계에서 사용자 확인 (사실상 `/sdlc:story` 를 3 번 직접 부르는 것과 동일)

Story ID 누락 시 안내하고 중단:

```
올바른 호출법:
/sdlc:auto-story <StoryID> [Plan경로|feature이름] [--no-merge] [--interactive]
```

Plan 경로 resolve 는 `/sdlc:story` 의 1 단계 블록과 동일하게 수행한다
(존재하는 파일이면 그대로, kebab-case 이름이면 `${CLAUDE_PROJECT_DIR}/docs/plans/plan-<name>.md`).
Plan 파일이 없으면 `❌ Plan 파일이 없습니다: <경로>` 출력 후 중단.

## 2 단계: 자동 진행 정책

**자동으로 넘어가는 지점**:

- `/story start` 킥오프 보고에 `## ⚠️ 확인 필요 사항` 이 **비어있음** → "구현 시작" 자동 입력 → 브랜치 생성 + 구현
- `kickoff.md` 가 이미 존재 → 자동 `y` (덮어쓰기). `/auto-story` 재실행 = 킥오프 갱신 의도
- `/story verify` 결과가 **✅ PASS** → 자동으로 complete 로 진행
- `/story complete` 가 끝나면 → (머지 모드) 자동으로 main 머지

**반드시 멈춰서 묻는 지점 (자동 모드에서도)**:

| 시점 | 사유 | 사용자에게 묻기 |
|------|------|---------------|
| start: `⚠️ 확인 필요 사항` 1 건 이상 | 설계 분기 (Q1, Q2 ...) — Claude 가 임의 결정 금지 | "Q1=? / Q2=? ..." 답변 요청 |
| start: 선행 의존성 미완 | deps.md 위반 — 위험 | "그래도 진행?" 확인 |
| start: 워킹 트리 dirty 또는 main 외 브랜치 | git 상태 비정상 | `/story` 의 분기 처리 그대로 |
| verify: 🟡 CONDITIONAL PASS / ❌ FAIL | AC 불충족 또는 DoD 미완 | 결과 제시 후 (a) 수정 후 재검증 / (b) 강제 complete / (c) 중단 |
| complete: 미해결 DoD | `/story` 3-C-1 분기 그대로 | 강제 완료 여부 확인 |
| complete: `complete.md` 가 이미 존재 | 이전 완료 이력 — 재처리 위험 | `/story` 의 y/N 프롬프트 전달 |
| 머지: 충돌 | 자동 해결 금지 (`--abort` 도 금지) | 충돌 파일 목록 제시 후 사용자 해결 대기 |
| 머지: push 필요 여부 | 기본은 push 안 함 | v1 은 `--push` 플래그 미구현, 사용자 수동 |

**`--interactive` 플래그가 켜져 있으면**: 위 자동 지점 전부 사용자 확인으로 변환.
즉 `/sdlc:story` 를 직접 호출하는 것과 동일 톤.

## 3 단계: 실행 흐름

### Step 1. start (킥오프)

`commands/story.md` 의 **3-A 절을 그대로 따른다** (3-A-0 ~ 3-A-5).
다만 3-A-4 킥오프 보고를 출력한 직후 분기:

- `## ⚠️ 확인 필요 사항` 섹션이 **비어있음**:
  - 1 줄 출력 (`▶ Question 0 건 — 자동 진행`) 후 곧바로 3-A-5 (kickoff.md 덮어쓰기 자동 `y` + 브랜치 생성) 및 구현 진행.
- 1 건 이상:
  - `/story` 와 동일하게 (a)/(b)/(c) 옵션 제시하고 사용자 응답 대기.
  - 사용자 답변 후 구현 진행.

`--interactive` 모드에서는 Question 유무 무관하게 항상 사용자 응답 대기.

### Step 2. verify (검증)

구현 완료 후 자동으로 `commands/story.md` **3-B 절** 수행 (테스트 실행 + AC 점검 + DoD 점검 + 표준 체크).

3-B-5 검증 요약 보고를 출력한 직후 분기:

- **최종 판정 ✅ PASS** → 1 줄 출력 (`▶ verify PASS — complete 진행`) 후 Step 3.
- **🟡 CONDITIONAL PASS / ❌ FAIL** → 결과 제시 후:
  ```
  verify 결과 위와 같습니다. 다음 중 선택:
  - (a) 수정 후 다시 verify (현재 브랜치 유지)
  - (b) 알려진 미완을 검증 로그에 기록하고 강제 complete
  - (c) 중단 (브랜치 유지, 작업 보류)
  ```

`--interactive` 모드에서는 PASS 여도 사용자 확인 후 진행.

### Step 3. complete (Plan 갱신)

`commands/story.md` **3-C 절** 수행 (3-C-1 최종 검증 → 3-C-2 Plan 헤더/Task 갱신 → 3-C-3 스냅샷 갱신 → 3-C-4 완료 보고 → 3-C-5 complete.md 저장).

- 미해결 DoD 가 있으면 자동 모드에서도 한 번 묻는다 (3-C-1 분기). 그 외에는 자동.
- `complete.md` 가 이미 존재하면 `/story` 의 y/N 프롬프트를 사용자에게 그대로 전달 (이전 완료 이력 보존 여부).

3-C-5 의 **커밋은 자동으로 수행** (구현 + Plan 분리 커밋 패턴).
머지 단계는 Step 4 로 이전한다 (3-C-6 의 "통합 방식 선택" 을 wrapper 가 자동 결정).

### Step 4. 로컬 머지 + 브랜치 정리

`--no-merge` 가 켜져있으면 이 단계 skip 하고 다음만 출력:

```
🌿 브랜치 `<branch>` 유지됨 (--no-merge). 수동 머지 또는 `/sdlc:pr <StoryID>` 진행 가능.
```

그렇지 않으면 `commands/story.md` 3-C-6 의 **(a) 로컬 머지 경로** 를 자동 수행:

```bash
git checkout <branch.main>
git merge --no-ff <branch.story_prefix><StoryID>-<slug> \
  -m "Merge Story <StoryID>: <제목 일부> (M? <달성수>/<총수>)"
git branch -d <branch.story_prefix><StoryID>-<slug>
```

- 머지 메시지 패턴은 `git log --oneline | grep "Merge Story"` 결과가 있으면 1 건 이상 참조해 동일 형식 유지.
  실사례가 없으면 `commands/story.md` 의 예시 포맷 (`Merge Story E1-S2: make ci 게이트`) 을 기준으로 사용한다.
- 마일스톤 진행 표기 `(M? <달성>/<총>)` 는 스냅샷 데이터에서 추출. 데이터 없으면 생략.

**충돌 발생 시**:

- 즉시 중단 (`git merge --abort` 자동 호출 금지)
- 충돌 파일 목록 + 안내 출력:
  ```
  ⚠️ 머지 충돌 발생. 자동 모드에서 해결하지 않습니다.
  충돌 파일:
    - <file1>
    - <file2>

  다음 중 선택:
  - (a) 충돌 해결 후 `git commit` 으로 머지 마무리
  - (b) `git merge --abort` 로 머지 취소 후 브랜치에서 재작업
  ```

**push 는 기본 skip**. 사용자가 별도로 `git push` 를 수동 수행.
(`--push` 플래그는 v1 에서 미구현 — 추후 필요 시 추가)

머지 성공 시 1 줄 출력:

```
🔀 머지 완료: <branch.main> ← <story 브랜치> (브랜치 삭제됨). main 으로 복귀.
```

## 4 단계: 최종 종합 보고

모든 단계 완료 후 한 번에 요약:

```markdown
# ✅ /sdlc:auto-story <StoryID> 완료

| 단계 | 결과 | 비고 |
|------|------|------|
| start | ✅ 자동 진행 (Question 0 건) | 브랜치 `story/E3-S4-...` 생성 |
| verify | ✅ PASS | 테스트 11/11 · coverage 100% |
| complete | ✅ Plan 갱신 + 커밋 2 건 | feat + docs(plan) |
| merge | ✅ main 머지 | 브랜치 삭제됨 |

스냅샷 변화: Story 13/33 → 14/33 (+1) · Task 42/91 → 45/91 (+3) · M2 2/7 → 3/7

다음 Story 제안: E4-S1 (TDD 의무, 크리티컬 패스 다음)
`/sdlc:auto-story E4-S1` 또는 `/sdlc:story start E4-S1` (수동) 로 시작 가능.
```

중간에 사용자 개입이 있었으면 해당 단계의 비고에 사유 기록.
예: "verify CONDITIONAL PASS — 사용자 (b) 강제 complete 선택".

## 5 단계: 안전 가드

- **머지·삭제는 Story 브랜치 패턴 (`<branch.story_prefix><StoryID>-...`) 을 정확히 따를 때만**.
  다른 브랜치는 자동으로 건드리지 않음.
- **push 는 자동으로 하지 않음**. 사용자 명시 요청 필요.
- **TDD 의무 Story** (Plan 에서 "TDD 의무" 문구가 있는 Story) 는 자동 진행 시에도
  **테스트 우선 순서 (실패 → 통과)** 를 지킨다. 단순 wrapper 라 `/story` 의 표준 흐름이 그대로 적용되므로 추가 분기 없음 (참고용).
- **이미 머지된 Story** 재호출 시: `/story start` 의 3-A-1 선행 조건 체크에서
  "이미 완료 [x]" 가 잡힘 → 사용자 확인 요청.
- **세션 중간에 컨텍스트가 끊긴 경우**: `--interactive` 로 재시작 권장.
  자동 모드는 단일 세션 내 전체 흐름을 가정.

## 에러 처리

- Story ID 누락 → 호출법 안내 후 중단
- Plan 에서 Story 못 찾음 → `/story` 와 동일 처리 (Story 목록 제시)
- Story 가 이미 완료 상태 (`<!-- 상태: done -->` 또는 모든 Task `[x]`) → 안내 후 사용자 확인 요청
- `make ci` 또는 테스트 실패가 verify 단계에서 발생 → CONDITIONAL PASS 분기로 처리 (Step 2 의 (a)/(b)/(c) 제시)
- Current Feature 미설정 + Plan 인자 미지정 → `/sdlc:story` 와 동일 메시지로 `/sdlc:feature` 선행 안내

## 참고 — `/sdlc:story` 와의 관계

- `/sdlc:auto-story` 는 `/sdlc:story` 의 단계별 인스트럭션을 **그대로 따른다** (복붙이 아니라 reference).
- 단계 정의·검증 로직·Plan 갱신 형식 등을 바꾸려면 `commands/story.md` 를 수정한다 —
  `/sdlc:auto-story` 는 자동으로 따라간다.
- `/sdlc:auto-story` 자체는 "언제 자동, 언제 사용자 확인" 정책만 정의한다.
