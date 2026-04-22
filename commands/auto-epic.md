---
argument-hint: [EpicID] [Plan경로|feature이름, 생략 시 current] [--sequential] [--max-parallel N] [--no-merge] [--interactive]
description: Epic 의 Story 들을 의존성 레벨로 나눠 병렬 subagent 로 실행 후 순차 fan-in
allowed-tools: Read, Write, Edit, Glob, Grep, Bash, Agent
---

# Auto-Epic — Epic 병렬 실행 + 순차 Fan-in

> **⚠️ Power-user 커맨드 (상위 난도).** 병렬 subagent · git worktree · 순차 fan-in 을 조합한다. `/sdlc:auto-story` 에 먼저 익숙해진 뒤, **Epic 안의 Story 들이 서로 독립적이고 각 Story 의 AC/접근 방법이 이미 확정된 상황**에서 쓰는 것이 안전하다.
>
> | 상황 | 권장 |
> |---|---|
> | 첫 Epic · 패턴 정착 전 | Story 단위 `/sdlc:story` 또는 `/sdlc:auto-story` 반복 |
> | deps.md 가 없거나 불완전 | 먼저 `/sdlc:plan` 으로 deps 정리 후 재시도 |
> | Story 간 공유 파일 편집이 많음 (충돌 위험) | `--sequential` 또는 수동 진행 |
> | 같은 Epic 안 Story 들이 독립적 · 설계 확정됨 | `/sdlc:auto-epic` 병렬 효과 ↑ |

`/sdlc:auto-story` 는 Story 한 건을 자동 진행한다. 이 커맨드는 **Epic 단위**로 받아 같은 Epic 안의
독립 Story 들을 **git worktree 에서 격리된 subagent 로 병렬 실행**하고, 각 레벨 완료 시 wrapper 가
**순차 fan-in** (main 머지 + plan.md 갱신) 을 수행한다.

기본 설계 원칙:
- **plan.md 쓰기는 wrapper 전용**. 병렬 worker 가 직접 Plan 을 건드리면 공유 쓰기 경합 → 머지 충돌 확정.
- **main 머지·브랜치 삭제도 wrapper 전용**. worker 는 Story 브랜치에 코드·보고서만 커밋.
- **subagent 는 사용자에게 질문 불가**. Question 이 필요한 Story 는 즉시 `needs_user` 로 반환 → wrapper 가 사용자에게 노출 후 재디스패치 또는 수동 안내.
- **deps.md 의 Epic 내부 엣지만** 사용. 크로스-Epic 엣지는 이미 완료 가정.

전체 인자: `$ARGUMENTS`

## 호출 예시

```
/sdlc:auto-epic E1                                  # current feature 의 plan, 기본 병렬
/sdlc:auto-epic E2 --max-parallel 5                 # 큰 Epic, 병렬 확대
/sdlc:auto-epic E3 --sequential                     # worktree 없이 직렬 — 디버깅/신중 실행
/sdlc:auto-epic E1 --no-merge                       # 레벨별 코드·보고서만 만들고 머지는 수동
/sdlc:auto-epic E1 --interactive                    # 레벨 진입마다 사용자 확인
/sdlc:auto-epic E1 docs/plans/plan-checkout-v2.md   # Plan 명시
/sdlc:auto-epic E1 checkout-v2                      # feature 이름으로 resolve
```

## 0 단계: 프로젝트 기본값 로드

`/sdlc:auto-story` 0 단계와 동일. `${CLAUDE_PROJECT_DIR}/CLAUDE.md` 의
`## 프로젝트 컨벤션 (커맨드 기본값)` yaml 블록을 읽고 동일 키 사용:

- `plan`, `plan_deps`
- `branch.main`, `branch.story_prefix`
- `test.coverage_command`, `lint.command`
- `standards.*`

블록이 없으면 default 로 계속 진행.

## 1 단계: 인자 파싱 + Plan 경로 resolve

- `$1`: Epic ID (필수, 예: `E1`)
- `$2` (선택, 위치 무관): Plan 경로 또는 feature 이름 (미지정 시 Current Feature resolve)
- 플래그 (위치 무관):
  - `--sequential` — worktree·병렬 사용 안 함, 메인 세션이 직접 한 번에 하나씩 auto-story 절차 실행
  - `--max-parallel N` — 동시 실행 subagent 상한 (default **3**)
  - `--no-merge` — 레벨별 fan-in 머지 skip (브랜치·worktree 유지, 수동 정리)
  - `--interactive` — 레벨 진입 전마다 사용자 확인

Epic ID 누락 시 안내하고 중단:

```
올바른 호출법:
/sdlc:auto-epic <EpicID> [Plan경로|feature이름] [--sequential] [--max-parallel N] [--no-merge] [--interactive]
```

Plan 경로 resolve 는 `/sdlc:story` 의 인자 파싱 블록 ([commands/story.md:29-60](commands/story.md#L29-L60)) 과 동일 로직 재사용.
Plan 파일 없으면 `❌ Plan 파일이 없습니다: <경로>` 출력 후 중단.

## 2 단계: Epic 해석 (메인 세션)

### 2-1. Epic 섹션 수집

Plan.md 에서 `### <EpicID>:` 헤더를 찾고 (없으면 Plan 내 Epic ID 목록 제시 후 중단),
해당 Epic 블록에서 `#### <EpicID>-S<m>` Story 헤더를 모두 추출한다.

패턴 참고 ([commands/plan.md:269-294](commands/plan.md#L269-L294)):
- Epic 헤더: `^### E1:`
- Story 헤더: `^#### E1-S[0-9a-z]+:`

각 Story 의 제목·담당 영역·크기·AC·DoD·Task 는 `/sdlc:story` 의 2 단계 로직과 동일하게 파싱.

### 2-2. 완료 상태 판별 (skip 대상 제외)

Story 헤더 라인 또는 바로 다음 줄에 `<!-- 상태: done -->` 이 있거나, 해당 Story 의 모든 Task 체크박스가 `[x]` 면 **skip**.
결과:
- `epic_stories` = Epic 내 전체 Story 리스트
- `pending_stories` = 미완료 Story 리스트 (실행 대상)
- `done_stories` = 이미 완료된 Story 리스트 (참고 출력만)

### 2-3. deps.md 파싱 + 위상정렬

Plan 파일 옆의 `<PLAN>.deps.md` (예: `plan-checkout-v2.deps.md`) 가 있으면 `Read` 로 로드.

- Mermaid 블록 안의 엣지 추출 ([commands/plan.md:330-344](commands/plan.md#L330-L344)):
  - 하드 의존 (실선): `^\s*(E\d+S\w+)\s*-->\s*(E\d+S\w+)`
  - 소프트 의존 (점선): `^\s*(E\d+S\w+)\s*-\.->\s*(E\d+S\w+)` — v1 에서는 하드와 동일하게 취급
- 노드 ID (`E1S1`) → Story ID (`E1-S1`) 변환: `^(E\d+)(S\w+)$` 로 매칭 후 하이픈 삽입
- **필터**: 현재 Epic 의 Story 가 아닌 노드는 의존 그래프에서 제거 (이미 완료 가정)
- 남은 엣지로 **Kahn's algorithm** 위상정렬 → 레벨 그룹 생성:
  - Level 1 = 이 Epic 내에서 의존 엣지가 들어오지 않는 Story
  - Level n+1 = Level 1~n 의 Story 가 모두 제거되었을 때 들어오는 엣지가 없는 Story

순환 의존 감지 시 중단: `❌ deps.md 에 순환 의존성 존재 (<사이클 Story 목록>). 수동 수정 필요.`

deps.md 가 **없거나 Mermaid 블록이 비어 있음** → `⚠️ deps.md 없음/비어 있음. --sequential 모드로 자동 전환 (Story ID 번호순 직렬 실행)` 경고 후 계속.

### 2-4. 실행 플랜 미리 보고

```markdown
# 🧭 Epic <EpicID> 실행 플랜

- 총 Story: 7 개 (완료 2, 실행 대상 5)
- 완료된 Story (skip): E1-S1, E1-S2
- Level 1 (병렬 2): E1-S3, E1-S4
- Level 2 (병렬 2): E1-S5, E1-S6
- Level 3 (단일): E1-S7
- 예상 max 병렬: 2 (`--max-parallel` 3 이하)
- 모드: parallel (또는 sequential)
- Fan-in: 머지 + plan.md 갱신 on (또는 --no-merge off)
```

- `--interactive` 가 켜져 있으면: `이 플랜으로 진행할까요? (y/N)` 대기.
- 그렇지 않으면 즉시 다음 단계로.

## 3 단계: 자동 진행 정책

### 3-1. 메인 세션이 멈추고 사용자에게 묻는 지점

| 시점 | 사유 | 동작 |
|---|---|---|
| Epic ID 미지정 / Plan 없음 / Epic 섹션 없음 | 사전 검증 실패 | 중단 + 안내 |
| deps.md 순환 의존 | 데이터 오류 | 중단 + 사이클 출력 |
| Level 진입 전 (`--interactive` 만) | 사용자 의도 확인 | y/N 프롬프트 |
| Level 결과 중 `needs_user` 존재 | Question 해결 필요 | (a)/(b)/(c) 옵션 제시 |
| Level 결과 중 `failed` 존재 | Story 실패 | (a)/(b) 옵션 제시 |
| Fan-in 머지 충돌 | 자동 해결 금지 | 중단 + 충돌 파일 목록 |
| `/sdlc:auto-story` 와 공통인 워킹 트리 dirty / main 외 브랜치 | git 상태 비정상 | `/story` 3-A-0 분기 그대로 |

### 3-2. Subagent 가 자동 판단하는 지점

`/sdlc:auto-story` 의 2 단계 정책 표를 **subagent 관점**으로 재표현:

- Kickoff `## ⚠️ 확인 필요 사항` 이 비어 있음 → 구현 진행
- Kickoff `## ⚠️ 확인 필요 사항` 1 건 이상 → 즉시 `STATUS: needs_user` 반환, 구현 금지
- verify `✅ PASS` → complete 진행 후 커밋
- verify `🟡 CONDITIONAL PASS` → 알려진 미완을 `complete.md` 에 기록하고 **강제 complete** (auto-story 의 (b) 옵션)
- verify `❌ FAIL` → `STATUS: failed` 반환, 강제 complete 금지
- 미해결 DoD → CONDITIONAL PASS 와 동일 처리 (기록 후 강제 complete)

## 4 단계: 실행 흐름

### Step 1. deps.md 파싱 + 레벨 산출

2-3 절 그대로 수행. 산출물: `levels = [[E1-S3, E1-S4], [E1-S5, E1-S6], [E1-S7]]` 같은 2 차원 리스트.

### Step 2. 실행 플랜 미리 보고

2-4 절 그대로 출력. `--interactive` 면 승인 대기.

### Step 3. 레벨별 Fan-out (parallel 모드)

`--sequential` 이 꺼져 있으면 각 레벨마다:

1. 레벨 안의 Story 수 > `--max-parallel` 이면: 앞에서부터 N 개씩 **슬라이스 배치** (배치 완료 후 다음 배치).
2. 한 배치의 모든 Story 를 **단일 메시지 안에서** `Agent` 복수 호출 (진짜 병렬):

```
Agent({
  description: "Execute Story E1-S3",
  subagent_type: "general-purpose",
  isolation: "worktree",
  prompt: <아래 subagent 프롬프트 템플릿>
})
Agent({
  description: "Execute Story E1-S4",
  subagent_type: "general-purpose",
  isolation: "worktree",
  prompt: <...>
})
```

`isolation: "worktree"` 는 Agent 도구가 임시 git worktree 를 자동 생성하고 subagent 종료 시 정리한다.

**Subagent 프롬프트 템플릿** (각 Story 정보로 치환해 전달):

```
당신은 Story <STORY_ID> "<STORY_TITLE>" 을 이 worktree 안에서 완료해야 합니다.
이 프롬프트는 self-contained 이며, 대화 맥락은 없습니다.

## 컨텍스트
- Plan 파일: <PLAN_ABSOLUTE_PATH>
- 이 Story 섹션은 Plan 안의 `#### <STORY_ID>:` 헤더 아래에 있습니다. Read 로 해당 섹션만 추출해 AC·DoD·Task 를 확인하세요.
- Feature 이름: <NAME>
- 관련 문서 (필요 시 Read): PRD (`docs/prd/prd-<NAME>.md`), architecture (`docs/architecture/architecture-<NAME>.md`), 해당 스택의 표준 (`docs/standards/...`)
- 참고 인스트럭션: `commands/story.md` 의 3-A·3-B·3-C 절과 `commands/auto-story.md` 의 2~3 단계. 이 내용을 이 worktree 안에서 **동일하게** 수행하세요. 단 아래 "금지 사항" 은 절대 위반하지 마세요.

## 필수 산출물
1. `story/<STORY_ID>-<kebab-slug>` 브랜치를 main 기반으로 생성하고 이 브랜치에서 작업 (worktree 루트에서 `git checkout -b ...`).
2. `${CLAUDE_PROJECT_DIR}/docs/plans/<NAME>/<STORY_ID>/kickoff.md` 작성 (commands/story.md 3-A-5 의 프런트매터 + 본문).
3. AC·DoD 에 부합하는 코드 + 테스트 작성 → 단위 테스트 실행 → 린트 → 커밋 (논리 단위별 분리 커밋).
4. `${CLAUDE_PROJECT_DIR}/docs/plans/<NAME>/<STORY_ID>/verify.md` 작성 (commands/story.md 3-B-6 형식).
5. `${CLAUDE_PROJECT_DIR}/docs/plans/<NAME>/<STORY_ID>/complete.md` 작성 (commands/story.md 3-C-5 형식).

## 금지 사항 (엄수)
- main/master 브랜치에 체크아웃하거나 머지하지 마세요.
- `<PLAN_ABSOLUTE_PATH>` (Plan 파일 본체) 를 수정하지 마세요. 상태 마크·체크박스·스냅샷 갱신은 wrapper 가 fan-in 에서 수행합니다.
- Story 브랜치를 삭제하지 마세요. worktree 를 직접 제거하지 마세요.
- `git push` 를 하지 마세요.

## 판정 정책
- Kickoff 보고서에 "⚠️ 확인 필요 사항" 이 1 건 이상이면 **코드 작성 전 즉시 반환**:
    STATUS: needs_user | questions: <한 줄 요약>
- verify 최종 판정 ✅ PASS → complete 진행 → 커밋 → 반환:
    STATUS: completed | branch: story/<STORY_ID>-<slug> | commits: <N>
- verify 🟡 CONDITIONAL PASS 또는 미해결 DoD → 알려진 미완을 complete.md 에 기록 후 강제 complete → 커밋 → 반환:
    STATUS: completed-forced | branch: story/<STORY_ID>-<slug> | commits: <N> | unresolved: <요약>
- verify ❌ FAIL → 커밋하지 말고 반환:
    STATUS: failed | reason: <한 줄 요약>

## 반환 형식
마지막 줄을 반드시 위 형식 중 하나의 단일 `STATUS: ...` 라인으로 끝내세요. 그 앞쪽은 요약 자유 서술 (변경 파일, 커밋 해시, 테스트 수 등).
```

3. **결과 수집**: 모든 `Agent` 결과 수신 후 각 결과의 마지막 `STATUS:` 라인을 파싱.

### Step 4. 결과 수집 + 사용자 개입

레벨 결과를 표로 출력:

```markdown
## Level <n> 결과

| Story | 상태 | 비고 |
|---|---|---|
| E1-S3 | ✅ completed | 커밋 2 |
| E1-S4 | ⚠️ needs_user | Q1: 캐시 TTL · Q2: 인덱스 naming |
| E1-S5 | ✅ completed-forced | 통합 테스트 1 건 미완 (기록됨) |
```

분기:
- **모두 completed/completed-forced** → 곧바로 Step 5 (Fan-in) 진행.
- **needs_user 또는 failed 존재** → 사용자에게 옵션 제시:
  ```
  Level <n> 에 needs_user 1 건, failed 0 건 있습니다. 다음 중 선택:
  - (a) 해당 Story 는 이번 Epic 에서 보류, 나머지 Fan-in 후 다음 레벨 진행 (후속 의존 Story 는 자동 차단)
  - (b) 전체 중단 (브랜치·worktree 유지, 수동 해결)
  - (c) 문제 Story 만 --interactive 로 즉시 재실행 (Question 해소 시 유용)
  ```
- 의존성 차단 규칙: 보류/실패된 Story 를 deps 그래프에서 "미완료" 로 유지 → 다음 레벨 계산 시 해당 Story 에 의존하는 후속 Story 는 **Level 대상에서 제외** (이번 Epic 에서는 실행 안 함).

### Step 5. 순차 Fan-in (레벨 완료 시마다)

`--no-merge` 가 켜져 있으면 skip.
그렇지 않으면 레벨 내 **성공한 Story** 를 deps 순 + Story ID 순으로 **한 건씩** 처리:

```bash
git checkout <branch.main>

# 머지
git merge --no-ff story/<STORY_ID>-<slug> \
  -m "Merge Story <STORY_ID>: <제목> (<EpicID>, auto-epic)"
```

머지 커밋 메시지는 [commands/story.md:622](commands/story.md#L622) 의 예시 포맷을 기반으로 `(<EpicID>, auto-epic)` 꼬리표를 추가해 배치 실행의 흔적을 남긴다. 마일스톤 진행 `(M? <달성>/<총>)` 는 스냅샷 데이터가 있을 때만 추가.

머지 성공 후:

1. **plan.md 갱신** (`/sdlc:story` 3-C-2, 3-C-3 로직 재사용):
   - Story 헤더에 `<!-- 상태: done -->` 추가
   - 해당 Story 의 Task 체크박스 `[x]` 로 전환
   - `## 📊 최근 상태 스냅샷` 섹션 갱신 (포맷: [commands/status.md](commands/status.md) 의 스냅샷 참조)
2. plan.md 를 별도 커밋:
   ```bash
   git add <PLAN>
   git commit -m "docs(plan): mark <STORY_ID> done via auto-epic"
   ```
3. Story 브랜치 삭제:
   ```bash
   git branch -d story/<STORY_ID>-<slug>
   ```
   (worktree 디렉토리는 Agent 도구의 `isolation: "worktree"` 가 자동 회수)

**머지 충돌 시**:
- 즉시 중단 (`git merge --abort` 자동 호출 금지)
- 충돌 파일 목록 + 안내:
  ```
  ⚠️ Fan-in 머지 충돌 (<STORY_ID>). 자동 해결하지 않습니다.
  충돌 파일:
    - <file1>
    - <file2>

  다음 중 선택:
  - (a) 충돌 해결 후 `git commit` 으로 머지 마무리, 그 다음 `/sdlc:auto-epic <EpicID>` 재개
  - (b) `git merge --abort` 로 취소 후 브랜치에서 재작업
  ```
- 충돌 이후 레벨은 **실행 안 함** (state 보존).

**push 는 자동 수행하지 않음**. 사용자가 별도로 `git push` 를 수동 수행.

## 5 단계: --sequential 모드

`--sequential` 플래그가 켜져 있거나 deps.md 부재로 자동 폴백된 경우:

- worktree·subagent 사용 안 함.
- 메인 세션이 직접 Story 들을 deps 순서대로 **한 번에 하나씩** auto-story 절차 수행:
  - `/sdlc:auto-story <STORY_ID>` 와 동일한 로직을 본문 안에서 실행 (`commands/auto-story.md` 의 2·3 단계 따름)
  - `--no-merge` 가 켜져 있으면 auto-story 의 머지도 skip
- 각 Story 완료 시 plan.md 즉시 갱신 (Story 마다 커밋 2 건: 구현 + docs(plan)).
- needs_user 발생 시: 해당 Story 에서 사용자 확인 받고 해결 → 계속. 해결 불가 시 중단.

장점: subagent 오버헤드 없음, 디버깅 쉬움, 컨텍스트 소비 낮음.
단점: 병렬 이득 없음 — 대신 auto-story 반복 호출보다 "한 세션에서 Epic 전체를 추적" 하는 편의성.

## 6 단계: 최종 종합 보고

모든 레벨 종료 후:

```markdown
# ✅ /sdlc:auto-epic <EpicID> 완료

## 실행 요약
| Level | Story | 상태 | 비고 |
|---|---|---|---|
| — | E1-S1 | ⏭ skipped | 이미 완료 |
| 1 | E1-S3 | ✅ completed | 커밋 2 · 테스트 12/12 |
| 1 | E1-S4 | ⚠️ needs_user | Q1, Q2 — 사용자 해결 대기 |
| 2 | E1-S5 | ✅ completed-forced | 통합 테스트 1 건 미완 기록 |
| — | E1-S6 | 🔒 blocked | E1-S4 의존 (차단) |

## 스냅샷 변화
- Epic <EpicID>: 2/7 → 5/7 (+3)
- 전체: Story 14/33 → 17/33 · Task 42/91 → 51/91 · M2 2/7 → 4/7

## 미해결 / 수동 진행 안내
- E1-S4 (needs_user): `/sdlc:auto-story E1-S4 --interactive` 로 재개
- E1-S6 (blocked by E1-S4): E1-S4 해결 후 `/sdlc:auto-story E1-S6` 또는 `/sdlc:auto-epic <EpicID>` 재실행

## 다음 Epic 제안
- E2 (모든 선행 완료) — `/sdlc:auto-epic E2`
```

사용자 개입이 있었던 레벨은 비고에 사유 기록 (예: "Level 1 에서 (c) --interactive 재실행 선택").

## 7 단계: 안전 가드

- **Epic 패턴 엄수**: `<EpicID>-S<m>` 정확히 일치하는 Story 만 처리. 다른 Epic 의 Story 는 건드리지 않음.
- **plan.md 쓰기·머지·브랜치 삭제는 wrapper 전용**. subagent 프롬프트에 금지 사항 명시, 위반 시 subagent 결과를 failed 로 취급.
- **Push 자동 미수행**.
- **Worktree 정리**: Agent 도구가 `isolation: "worktree"` 계약으로 자동 처리. 변경이 남아 있으면 worktree 가 보존되므로, 보존된 worktree 경로는 최종 보고에 목록화해서 사용자에게 수동 정리 안내.
- **`--max-parallel` 상한**: 기본 3. 상한 너머로 올리려면 플래그 명시 필요. 메인 세션이 하나의 메시지 안에서 띄우는 `Agent` tool_use 수로 제어.
- **Subagent 타임아웃·재시도 없음 (v1)**: 지연 시 사용자가 세션 중단 후 수동 정리.
- **TDD 의무 Story**: subagent 프롬프트에 `commands/auto-story.md` 5 단계 참조 — 별도 분기 없음 (auto-story 정책 그대로 계승).

## 에러 처리

- Epic ID 누락 → 호출법 안내 후 중단
- Plan 파일 없음 → `/sdlc:story` 와 동일 안내
- Plan 에 Epic 섹션 없음 → Plan 내 Epic ID 목록 제시 후 중단
- deps.md 없음/비어 있음 → `--sequential` 자동 폴백 + 경고 출력
- deps.md 순환 의존 → 사이클 출력 후 중단
- subagent 가 `STATUS:` 라인 없이 반환 → `failed` 로 취급, reason 에 "프로토콜 위반" 기록
- Fan-in 머지 충돌 → 즉시 중단, state 보존
- 워킹 트리 dirty / main 외 브랜치 → `/sdlc:story` 의 3-A-0 분기 그대로 적용

## 참고 — `/sdlc:auto-story`, `/sdlc:story` 와의 관계

- `/sdlc:auto-epic` 는 Story 단위 로직을 **직접 재구현하지 않는다**. 각 subagent 프롬프트가 `commands/story.md` 와 `commands/auto-story.md` 를 reference 하도록 지시한다.
- Story 단계 로직(AC 점검, DoD 점검, 표준 체크, kickoff/verify/complete 보고서 포맷 등) 을 바꾸려면 `commands/story.md` 를 수정한다 — auto-epic 은 자동으로 따라간다.
- 자동 진행 정책 (Question 유무 · CONDITIONAL PASS 처리 등) 을 바꾸려면 `commands/auto-story.md` 를 수정한다 — auto-epic 의 subagent 도 그대로 따른다.
- auto-epic 자체는 **Epic 오케스트레이션 정책** (의존성 그래프, 레벨 실행, Fan-in, 충돌 처리) 만 정의한다.
