# auto-epic cwd 가드 본체 + 자동 reset 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** v1.9.0 STATUS 표의 `cwd-guard-violated` 자리표시를 채우는 후속 PR — subagent 측 worktree-list 재유도 가드 + wrapper 측 자동 reset 확장.

**Architecture:** v1.9.0 의 dispatch 흐름 (사전 캡처 → prompt 치환 → fan-out → 사후검증) 위에 (a) wrapper 사전 캡처에 `STORY_BRANCH` 추가, (b) subagent 프롬프트에 신규 "## 작업 컨텍스트 가드" 섹션 + 컨텍스트 bullet + 금지 사항 한 줄, (c) wrapper 사후검증의 옵션 (a) 표기 변경 + 자동 reset 절차. 모든 변경은 `commands/auto-epic.md` + 버전 파일 + README 만 만진다.

**Tech Stack:** Markdown (Claude 프로시저), git 표준 (`git worktree list --porcelain`, `git reset --hard`), awk

**Spec:** [docs/specs/2026-05-07-auto-epic-cwd-guard-design.md](./2026-05-07-auto-epic-cwd-guard-design.md)

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `commands/auto-epic.md` | **수정** — Step 3-1 사전 캡처에 STORY_BRANCH 추가, subagent 컨텍스트 bullet, 신규 "## 작업 컨텍스트 가드" 섹션, 금지 사항 한 줄 추가, 사후검증 옵션 (a) 활성화 |
| `.claude-plugin/plugin.json` | **수정** — version `1.9.0` → `1.10.0` |
| `.claude-plugin/marketplace.json` | **수정** — version `1.9.0` → `1.10.0` |
| `README.md` | **수정** — Changelog 에 v1.10.0 항목 추가 |

`templates/CLAUDE.md` 등 사용자 프로젝트 복사 파일은 변경 없음.

---

## Task 1: Wrapper Step 3-1 사전 캡처에 STORY_BRANCH 추가

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 169~174 의 사전 캡처 블록)

- [ ] **Step 1: 현재 사전 캡처 블록 확인**

```bash
sed -n '169,175p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```

Expected: v1.9.0 의 EXPECTED_BASE_SHA + MAIN_BEFORE 캡처 블록.

- [ ] **Step 2: Edit 으로 사전 캡처 블록 확장**

`old_string`:
````
1. **사전 캡처 (배치 dispatch 직전)**: wrapper 가 다음 두 SHA 를 캡처한다.
   ```bash
   EXPECTED_BASE_SHA=$(git rev-parse main)
   MAIN_BEFORE=$(git rev-parse main)   # 본 PR 시점에서는 EXPECTED_BASE_SHA 와 동일, Step 4 의 사후검증용으로 별도 변수 유지
   ```
   `EXPECTED_BASE_SHA` 는 다음 단계 prompt 치환 시 각 subagent 의 `<EXPECTED_BASE_SHA>` 자리에 그대로 들어간다 (배치 안의 모든 Story 가 같은 값 공유 — 같은 dispatch 시점).
````

`new_string`:
````
1. **사전 캡처 (배치 dispatch 직전)**: wrapper 가 다음 값을 캡처한다.
   - **배치 단위** (배치 안 모든 Story 공유):
     ```bash
     EXPECTED_BASE_SHA=$(git rev-parse main)
     MAIN_BEFORE=$(git rev-parse main)   # Step 4 사후검증용 별칭
     ```
   - **Story 별** (각 prompt 치환 시):
     ```bash
     STORY_BRANCH="story/${STORY_ID}-${SLUG}"   # 예: story/E1-S3-design-tokens
     ```

   치환 흐름:
   - `EXPECTED_BASE_SHA` → 각 subagent prompt 의 `<EXPECTED_BASE_SHA>` 자리.
   - `STORY_BRANCH` → 각 subagent prompt 의 `<STORY_BRANCH>` 자리. 가드와 worktree 재유도의 식별자로 쓰이며 plugin 의 branch naming 컨벤션이 안정적 식별자 역할을 한다.
````

- [ ] **Step 3: 검증**

```bash
grep -n "STORY_BRANCH=" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
grep -n "Story 별\|배치 단위" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 각 1건 이상 (사전 캡처 블록 안).

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
feat(auto-epic): wrapper 사전 캡처에 STORY_BRANCH 추가

- 배치 단위 (EXPECTED_BASE_SHA, MAIN_BEFORE) vs Story 별 (STORY_BRANCH) 분리
- STORY_BRANCH 는 가드/재유도 식별자로 prompt 치환 시 literal 등장
- branch naming 컨벤션이 안정적 식별자 역할

후속 task 의 가드 코드와 컨텍스트 bullet 의 기반.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Subagent 컨텍스트에 STORY_BRANCH bullet 추가

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 207 의 EXPECTED_BASE_SHA bullet 직후)

- [ ] **Step 1: 현재 컨텍스트 섹션 확인**

```bash
sed -n '201,209p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```

Expected: `## 컨텍스트` 섹션 + bullet 들 (마지막이 EXPECTED_BASE_SHA bullet, 그 다음이 빈 줄, `## 필수 산출물`).

- [ ] **Step 2: Edit 으로 EXPECTED_BASE_SHA bullet 직후에 STORY_BRANCH bullet 추가**

`old_string`:
```
- 기준 SHA: `<EXPECTED_BASE_SHA>` — Story 브랜치의 base 로 사용. wrapper 가 dispatch 직전 `git rev-parse main` 으로 캡처한 main HEAD. worktree 의 현재 HEAD 가 stale 일 수 있으므로 이 값을 직접 사용하세요.

## 필수 산출물
```

`new_string`:
```
- 기준 SHA: `<EXPECTED_BASE_SHA>` — Story 브랜치의 base 로 사용. wrapper 가 dispatch 직전 `git rev-parse main` 으로 캡처한 main HEAD. worktree 의 현재 HEAD 가 stale 일 수 있으므로 이 값을 직접 사용하세요.
- Story 브랜치 이름: `<STORY_BRANCH>` — 가드와 worktree 재유도의 식별자. wrapper 가 dispatch 시점에 `story/<STORY_ID>-<slug>` 로 계산해 주입한다. 본 prompt 안에서 literal 로 사용 (예: `STORY_BRANCH="story/E1-S3-design-tokens"`).

## 필수 산출물
```

- [ ] **Step 3: 검증**

```bash
grep -n "STORY_BRANCH" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: Task 1 의 사전 캡처 + 본 task 의 컨텍스트 bullet = 2~3건 이상.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "feat(auto-epic): 프롬프트 컨텍스트에 STORY_BRANCH bullet 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: 신규 "## 작업 컨텍스트 가드" 섹션 추가

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 218 (산출물 5번 마지막) 직후, line 220 의 `## 금지 사항 (엄수)` 직전)

- [ ] **Step 1: 산출물 5번 → 금지 사항 사이 확인**

```bash
sed -n '217,221p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```

Expected:
```
5. `${CLAUDE_PROJECT_DIR}/docs/plans/<NAME>/<STORY_ID>/complete.md` 작성 (commands/story.md 3-C-5 형식).

## 금지 사항 (엄수)
```

- [ ] **Step 2: 신규 섹션을 산출물 5번 다음에 삽입**

`old_string`:
```
5. `${CLAUDE_PROJECT_DIR}/docs/plans/<NAME>/<STORY_ID>/complete.md` 작성 (commands/story.md 3-C-5 형식).

## 금지 사항 (엄수)
```

`new_string` (백틱 escape 주의 — outer fence 4개, inner fence 3개로 nesting):
````
5. `${CLAUDE_PROJECT_DIR}/docs/plans/<NAME>/<STORY_ID>/complete.md` 작성 (commands/story.md 3-C-5 형식).

## 작업 컨텍스트 가드 (필수)

산출물 1번 (Story 브랜치 생성) 이후의 모든 **git / 빌드 / 테스트 / lint** 명령은 다음 가드를 첫 줄로 prepend 한 뒤 실행하세요. Bash tool 호출 사이에 cwd 가 main worktree 로 라우팅되는 환경 동작이 관측되었으므로, 매 호출에서 **stateless 로 worktree 를 재유도** 합니다.

```bash
STORY_BRANCH="<STORY_BRANCH>"   # 위 컨텍스트의 자리표시 값을 literal 로 — 예: "story/E1-S3-design-tokens"
WT="$(git worktree list --porcelain | awk '
  /^worktree /{wt=$2}
  /^branch refs\/heads\/'"$STORY_BRANCH"'$/{print wt}
')"
[ -n "$WT" ] && cd "$WT" || {
  echo "STATUS: failed | reason: cwd-guard-violated"
  exit 1
}
```

**적용 대상**:
- 모든 `git ...` 명령 (단 산출물 1번의 `git checkout -b` 자체는 *예외* — branch 가 아직 없으므로 가드 매칭 실패).
- 빌드/테스트/lint 도구 호출 (예: `pnpm test`, `pytest`, `cargo build`, `go test`, `./gradlew check`).
- 파일 수정으로 이어지는 명령 (예: scaffolding tool, codegen).

**적용 면제**:
- Read-only 명령 (`ls`, `cat`, `grep`, Read tool) — main 오염으로 이어지지 않음.
- 산출물 1번의 첫 `git checkout -b ...` 명령 — branch 가 아직 worktree-list 에 없음.

**가드 실패 (worktree-list 에 매칭 branch 없음) 시**:
- 자체 회복 시도 X (cherry-pick / reflog 탐색 등 금지).
- `STATUS: failed | reason: cwd-guard-violated` 로 즉시 반환.

## 금지 사항 (엄수)
````

- [ ] **Step 3: 검증 — 신규 섹션 + 가드 코드 + 적용 표 등장**

```bash
grep -n "## 작업 컨텍스트 가드" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
grep -n "git worktree list --porcelain" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
grep -n "적용 대상\|적용 면제" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
grep -c "cwd-guard-violated" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 신규 섹션 1건, 가드 코드 1건, 적용 대상/면제 각 1건. cwd-guard-violated 등장 횟수 ≥ 2 (v1.9.0 STATUS 표 + 본 task 가드).

- [ ] **Step 4: 가드 bash 코드 syntax 검증**

해당 코드를 임시 파일로 추출해 `bash -n` 으로 syntax 만 검사 (실 실행 X — `STORY_BRANCH` literal 값을 placeholder 로 채워):

```bash
cat > /tmp/cwd-guard-syntax-test.sh <<'BASH'
STORY_BRANCH="story/E1-S3-design-tokens"
WT="$(git worktree list --porcelain | awk '
  /^worktree /{wt=$2}
  /^branch refs\/heads\/'"$STORY_BRANCH"'$/{print wt}
')"
[ -n "$WT" ] && cd "$WT" || {
  echo "STATUS: failed | reason: cwd-guard-violated"
  exit 1
}
BASH
bash -n /tmp/cwd-guard-syntax-test.sh && echo "SYNTAX OK"
rm /tmp/cwd-guard-syntax-test.sh
```
Expected: `SYNTAX OK`.

- [ ] **Step 5: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
feat(auto-epic): subagent 프롬프트에 작업 컨텍스트 가드 섹션 추가

worktree-list 재유도 가드 — STORY_BRANCH literal 로 매 호출 stateless
재유도, cwd 가 main 으로 라우팅되어도 자동 복귀.

- 적용 대상: git/빌드/테스트/lint 명령 (branch 생성 명령은 예외)
- 적용 면제: read-only (ls/cat/grep) — main 오염 X
- 가드 실패 시 자체 회복 시도 X — STATUS: failed | reason: cwd-guard-violated

v1.9.0 STATUS 표 cwd-guard-violated 자리표시의 실제 trigger.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 금지 사항에 가드 우회 금지 한 줄 추가

**Files:**
- Modify: `commands/auto-epic.md` (Task 3 후 line 번호 밀림 — 금지 사항 섹션은 grep 으로 위치 재확인)

- [ ] **Step 1: 금지 사항 마지막 bullet 위치 확인**

```bash
grep -n "git push.*하지 마세요" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 1건. 그 줄이 금지 사항의 마지막 bullet.

- [ ] **Step 2: Edit 으로 마지막 bullet 다음에 가드 우회 금지 추가**

`old_string`:
```
- `git push` 를 하지 마세요.
```

`new_string`:
```
- `git push` 를 하지 마세요.
- 작업 컨텍스트 가드를 우회하지 마세요. `cd <main repo path>`, `git -C <main repo path>`, 환경변수 우회 (`$STORY_BRANCH` 재정의 등) 모두 금지. 가드 실패 시 자체 회복 시도 X — `STATUS: failed | reason: cwd-guard-violated` 반환만.
```

- [ ] **Step 3: 검증**

```bash
grep -n "작업 컨텍스트 가드를 우회하지 마세요" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 1건.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "feat(auto-epic): 금지 사항에 가드 우회 금지 조항 추가

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 5: Wrapper 사후검증 옵션 (a) 활성화 + 자동 reset 절차 명시

**Files:**
- Modify: `commands/auto-epic.md` (사후검증 알림 블록 — line 번호 밀림. grep 으로 재확인)

- [ ] **Step 1: 옵션 (a) 표기 위치 확인**

```bash
grep -n "본 PR 미구현" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 2건 (옵션 a 라인 + 그 아래 보충 설명 줄).

- [ ] **Step 2: 옵션 (a) 라인의 미구현 표기 제거**

`old_string`:
```
     - (a) main 을 BEFORE 로 자동 reset (story 브랜치는 보존) [본 PR 미구현 — 사용자 수동]
     - (b) 수동 검토 (이 Epic 중단)
```

`new_string`:
```
     - (a) main 을 BEFORE 로 자동 reset (story 브랜치는 보존) — 사용자 (y/N) 명시 동의 필수
     - (b) 수동 검토 (이 Epic 중단)
```

- [ ] **Step 3: 보충 설명 단락 교체 — 자동 reset 절차로**

`old_string`:
```
     본 PR 시점에서는 자동 reset 미구현 — 사용자 수동 처리. 자동 reset 은 후속 PR (destructive 동작 검토 후).
```

`new_string`:
````
     **옵션 (a) 자동 reset 절차** (사용자가 (a) 를 명시 선택한 경우에만 실행 — destructive, 묵시 진행 금지):

     ```bash
     git checkout main
     git reset --hard <MAIN_BEFORE>
     git worktree list   # story/* 브랜치는 별도 ref 라 그대로 보존됨 — 출력에서 확인
     ```

     reset 후 다음 1줄 출력:
     ```
     ✅ main 을 <MAIN_BEFORE> 로 reset 완료. 보존된 story/* 브랜치: <개수> 개 (worktree 정상).
     ```

     reset 명령이 실패하면 (drift / 충돌) 즉시 중단하고 사용자에게 수동 처리 안내. 자동 retry X.
````

- [ ] **Step 4: 검증 — 미구현 표기 제거 + 자동 reset 절차 등장**

```bash
grep "본 PR 미구현" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md || echo "(미구현 표기 제거됨 — OK)"
grep -n "옵션 (a) 자동 reset 절차\|y/N. *명시 동의\|git reset --hard" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 첫 명령 "미구현 표기 제거됨", 두번째 명령 절차 + (y/N) + reset 명령 등장.

- [ ] **Step 5: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
feat(auto-epic): wrapper 사후검증 옵션 (a) 자동 reset 활성화

v1.9.0 의 사후검증 알림 단계 옵션 (a) 가 [본 PR 미구현] 자리표시
였던 것을 실제 자동 reset 절차로 채움:
- 사용자 (y/N) 명시 동의 필수 (destructive)
- git checkout main && git reset --hard <MAIN_BEFORE>
- story/* 브랜치는 별도 ref 라 보존
- reset 실패 시 즉시 중단, 자동 retry X

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: plugin.json + marketplace.json 버전 v1.10.0 동시 bump

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

CLAUDE.md 규약: "편집 후 반드시 plugin.json + marketplace.json 버전 동시 bump".

- [ ] **Step 1: plugin.json version 변경**

`old_string`:
```
  "version": "1.9.0",
```

`new_string`:
```
  "version": "1.10.0",
```

- [ ] **Step 2: marketplace.json version 변경**

`old_string`:
```
      "version": "1.9.0"
```

`new_string`:
```
      "version": "1.10.0"
```

- [ ] **Step 3: 검증 — 두 파일 동기화**

```bash
grep '"version"' /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/plugin.json /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/marketplace.json
```
Expected: 두 파일 모두 `1.10.0`.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "chore(release): bump version 1.9.0 → 1.10.0"
```

---

## Task 7: README Changelog v1.10.0 항목 추가

**Files:**
- Modify: `README.md` (현재 v1.9.0 항목 위에 v1.10.0 삽입)

- [ ] **Step 1: 현재 v1.9.0 항목 위치 확인**

```bash
grep -n "^- \*\*v1\.9\.0\*\*" /Users/nhn/workspace/claude_prac/sdlc-plugin/README.md
```
Expected: 1건 (현재 line 228 부근).

- [ ] **Step 2: v1.9.0 항목 위에 v1.10.0 삽입**

`old_string` (확정성 위해 v1.9.0 라인 시작 ~10자만):
```
- **v1.9.0** — `/sdlc:auto-epic`
```

`new_string`:
```
- **v1.10.0** — `/sdlc:auto-epic` 의 cwd 가드 본체 + wrapper 자동 reset 활성화 (v1.9.0 의 후속 PR): (1) **Subagent 측 예방** — 산출물 1번 (브랜치 생성) 이후의 모든 git/빌드/테스트/lint 명령에 worktree-list 재유도 가드를 첫 줄 prepend. `STORY_BRANCH` literal (`story/<ID>-<slug>`) 을 식별자로 매 호출 stateless 재유도 — Bash tool state 비유지 우회. cwd 가 main worktree 로 라우팅되어도 자동 복귀, 가드 매칭 실패 시 `STATUS: failed | reason: cwd-guard-violated` (자체 회복 X). Read-only 명령과 첫 `git checkout -b` 는 면제. 금지 사항에 가드 우회 금지 조항 추가. (2) **Wrapper 측 회복** — v1.9.0 의 사후검증 알림 단계 옵션 (a) `[본 PR 미구현]` 자리표시를 실제 자동 reset 절차로 채움. 사용자 (y/N) 명시 동의 필수 (destructive). `git reset --hard <MAIN_BEFORE>` — story/* 브랜치는 별도 ref 라 보존. reset 실패 시 즉시 중단·자동 retry X. (3) v1.9.0 STATUS 표의 `cwd-guard-violated` 자리표시가 실제 trigger 와 일대일 대응. 후속 PR 후보: A3 환경 충돌 detection 가이드, A4 soft deps 위상정렬 분리.
- **v1.9.0** — `/sdlc:auto-epic`
```

- [ ] **Step 3: 검증**

```bash
grep -n "^- \*\*v1\.10\.0\*\*\|^- \*\*v1\.9\.0\*\*" /Users/nhn/workspace/claude_prac/sdlc-plugin/README.md
```
Expected: v1.10.0 라인 번호 < v1.9.0 라인 번호 (v1.10.0 위에).

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add README.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "docs(readme): v1.10.0 changelog — cwd 가드 본체 + 자동 reset"
```

---

## Task 8: 통합 점검

**Files:** 없음 (read-only 확인)

- [ ] **Step 1: 전체 변경 파일 + 커밋 확인**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin log --oneline -10
```
Expected: spec 커밋 1건 + plan 커밋 1건 + Task 1-7 커밋 7건 = 9 커밋.

- [ ] **Step 2: spec §3 변경 상세 6개 항목 모두 반영 확인**

```bash
echo "=== §3-1 STORY_BRANCH wrapper 캡처 ==="
grep -c "STORY_BRANCH=" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-2 컨텍스트 bullet ==="
grep -c "Story 브랜치 이름" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-3 신규 가드 섹션 ==="
grep -c "## 작업 컨텍스트 가드" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-3 가드 코드 (worktree list awk) ==="
grep -c "git worktree list --porcelain" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-4 가드 우회 금지 ==="
grep -c "가드를 우회하지 마세요" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-5 자동 reset 활성화 ==="
grep -c "옵션 (a) 자동 reset 절차" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== 미구현 표기 제거 ==="
grep "본 PR 미구현" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md || echo "(미잔존 — OK)"
echo "=== §3-6 버전 v1.10.0 ==="
grep '"1.10.0"' /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/plugin.json /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/marketplace.json
echo "=== README v1.10.0 ==="
grep -c "^- \*\*v1\.10\.0\*\*" /Users/nhn/workspace/claude_prac/sdlc-plugin/README.md
```
Expected: 모두 ≥ 1 / "(미잔존 — OK)" / 두 파일 1.10.0 매칭 / README 1건.

- [ ] **Step 3: spec §5 검증 시나리오 매핑**

| spec §5 시나리오 | 본 PR 결과물 | 확인 명령 |
|---|---|---|
| 1. 가드 코드 syntax | Task 3 Step 4 의 `bash -n` | (재실행 가능) |
| 2. 적용 범위 명문화 | Task 3 의 적용 대상/면제 표 | grep "적용 대상\|적용 면제" |
| 3. STORY_BRANCH 단일 출처 | Task 1·2·3 의 3 지점 | grep "STORY_BRANCH" |
| 4. 자동 reset (y/N) | Task 5 의 절차 + 동의 | grep "(y/N) 명시 동의" |
| 5. STATUS 매트릭스 정합성 | v1.9.0 표의 cwd-guard-violated 자리 + 본 PR 가드 trigger | grep -c "cwd-guard-violated" — ≥ 3 (표 + 가드 + 금지 사항 + 사후 정책) |
| 6. v1.9.0 호환성 | 회귀 — base-stale, completed-degraded 코드 모두 표 안 그대로 | grep "base-stale\|completed-degraded" |

```bash
grep -c "cwd-guard-violated" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
grep -c "base-stale\|completed-degraded" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 첫 명령 ≥ 3 (표 1 + 가드 출력 1 + 금지 사항 1 + 사후검증 표 정책 1 = 합 4 정도). 두번째 명령 ≥ 2 (v1.9.0 표 안에 그대로).

- [ ] **Step 4: 변경 후 auto-epic.md 의 가드 섹션 직접 통람 (시각 확인)**

```
Read commands/auto-epic.md (line 220 ~ 280 정도)
```
가드 섹션 + 금지 사항 + 판정 정책 + 사후검증 절차가 마크다운 nesting (백틱 fence) 깨짐 없이 렌더되는지 시각 점검.

- [ ] **Step 5: 푸시 안내 (사용자 결정)**

본 plan 은 푸시를 자동 수행하지 않는다. 사용자가 확인 후 `git push origin main` 직접 호출.

---

## Self-Review Notes

본 plan 작성 후 spec 대비 점검:

- **Spec §3-1 (사전 캡처에 STORY_BRANCH)**: Task 1. ✅
- **Spec §3-2 (컨텍스트 bullet)**: Task 2. ✅
- **Spec §3-3 (작업 컨텍스트 가드 섹션)**: Task 3 (가드 코드 + 적용 표 + bash syntax 검증 포함). ✅
- **Spec §3-4 (금지 사항 우회 금지)**: Task 4. ✅
- **Spec §3-5 (사후검증 자동 reset)**: Task 5 (옵션 (a) 표기 변경 + 절차). ✅
- **Spec §3-6 (버전 bump)**: Task 6 (plugin/marketplace) + Task 7 (changelog). ✅
- **Spec §4 (의도적 비포함)**: Task 어디에도 read-only 명령 가드, 가드 우회 디텍션, 자체 회복, 비-git 가드 없음. ✅
- **Spec §5 (검증 시나리오)**: Task 8 가 6개 항목 매핑 점검. ✅

타입 정합성:
- `STORY_BRANCH` — Task 1 (캡처) → Task 2 (컨텍스트) → Task 3 (가드) → Task 4 (금지) — 4 지점 동일 표기. ✅
- `<MAIN_BEFORE>` — v1.9.0 캡처 변수 → Task 5 reset 명령 인자. ✅
- `cwd-guard-violated` — v1.9.0 STATUS 표 (자리표시) → Task 3 (가드 출력) → Task 4 (금지 reference) — 일관. ✅
- 가드 bash 코드 — Task 3 의 awk 패턴이 외부 따옴표 + 단일 따옴표 nesting. Task 3 Step 4 의 syntax 검증으로 보장. ✅
