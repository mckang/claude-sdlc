# auto-epic soft deps 위상정렬 분리 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** mermaid 점선 (`-.->`) 소프트 의존을 위상정렬 블로킹에서 제외하고 consumer Story 의 advisory 로 surface — 핸드오프 A8 의 병렬화 기회 손실 해결.

**Architecture:** v1.10.0 의 dispatch 흐름 (사전 캡처 → prompt 치환 → fan-out) 위에 (a) deps 파서·위상정렬 본문에 hard/soft 분리 명시, (b) Step 3-1 사전 캡처에 `SOFT_PREDECESSORS` 추가, (c) subagent 컨텍스트에 조건부 advisory bullet, (d) 실행 플랜 미리 보고 형식에 soft advisory 라인, (e) deps 템플릿 범례 갱신. 모든 변경은 `commands/auto-epic.md` + `templates/reports/plan/deps.md` + 버전 파일 + README.

**Tech Stack:** Markdown (Claude 프로시저), 정규식 (mermaid 엣지 파싱), Kahn's algorithm 본문 묘사

**Spec:** [docs/specs/2026-05-07-auto-epic-soft-deps-design.md](./2026-05-07-auto-epic-soft-deps-design.md)

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `commands/auto-epic.md` | **수정** — §2-3 deps 파서 분리 / §2-4 미리 보고 형식 / Step 3-1 SOFT_PREDECESSORS 캡처 / subagent 컨텍스트 advisory bullet |
| `templates/reports/plan/deps.md` | **수정** — 범례의 소프트 의존 의미 확장 |
| `.claude-plugin/plugin.json` | **수정** — version `1.10.0` → `1.11.0` |
| `.claude-plugin/marketplace.json` | **수정** — version `1.10.0` → `1.11.0` |
| `README.md` | **수정** — Changelog 에 v1.11.0 항목 |

---

## Task 1: §2-3 deps 파싱 + 위상정렬 본문 재작성

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 95~110)

- [ ] **Step 1: 현재 §2-3 본문 확인**

```bash
sed -n '95,111p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: hard/soft 정규식 + "v1 에서는 하드와 동일하게 취급" 주석 + Kahn 설명 + cycle 단일 정책.

- [ ] **Step 2: §2-3 전체 블록을 분리 처리 본문으로 교체**

`old_string`:
````
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
````

`new_string`:
````
### 2-3. deps.md 파싱 + 위상정렬 (v1.11.0+: hard/soft 분리)

Plan 파일 옆의 `<PLAN>.deps.md` (예: `plan-checkout-v2.deps.md`) 가 있으면 `Read` 로 로드.

- Mermaid 블록 안의 엣지 추출 ([commands/plan.md:330-344](commands/plan.md#L330-L344)) — **두 set 으로 분리**:
  - **하드 의존** (실선): `^\s*(E\d+S\w+)\s*-->\s*(E\d+S\w+)` → `hard_edges`. consumer 코드가 producer 의 *완료된 코드* 를 import/사용.
  - **소프트 의존** (점선): `^\s*(E\d+S\w+)\s*-\.->\s*(E\d+S\w+)` → `soft_edges`. consumer 가 producer 의 *합의/계약* (props/API/스키마 또는 Mock 인터페이스) 만 필요. v1.11.0+ 부터 위상정렬에서 **블로킹 X**.
- 노드 ID (`E1S1`) → Story ID (`E1-S1`) 변환: `^(E\d+)(S\w+)$` 로 매칭 후 하이픈 삽입.
- **필터**: 현재 Epic 의 Story 가 아닌 노드는 두 set 에서 모두 제거 (이미 완료 가정).
- **위상정렬 입력**: `hard_edges` **만**. **Kahn's algorithm** 으로 레벨 그룹 생성.
  - Level 1 = 이 Epic 내에서 hard 엣지가 들어오지 않는 Story
  - Level n+1 = Level 1~n 의 Story 가 모두 제거되었을 때 hard 엣지가 들어오지 않는 Story
- **Soft advisory 테이블**: `soft_predecessors[S] = {X | (X,S) ∈ soft_edges}`. consumer Story 의 prompt 치환 시 advisory bullet 으로 surface (Step 3-1·subagent 컨텍스트 참조).

**순환 의존 검사** (분리):
- `hard_edges` 에 cycle → 즉시 중단: `❌ deps.md 의 hard 엣지에 순환 의존성 존재 (<사이클 Story 목록>). 수동 수정 필요.`
- `soft_edges` 만의 cycle (hard 엣지 0건 포함) → 정보성 1줄 출력 후 계속: `ℹ️ deps.md 의 soft 엣지에 순환 발견 (<사이클>). advisory 만이라 block 안 됨.`
- hard 와 soft 가 섞인 cycle → hard 엣지만 추출해 위 hard 검사 적용. 통과하면 진행.

deps.md 가 **없거나 Mermaid 블록이 비어 있음** → `⚠️ deps.md 없음/비어 있음. --sequential 모드로 자동 전환 (Story ID 번호순 직렬 실행)` 경고 후 계속.
````

- [ ] **Step 3: 검증 — 분리 처리 + cycle 두 정책 + soft_predecessors 등장**

```bash
grep -n "hard_edges\|soft_edges\|soft_predecessors" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
grep -n "v1 에서는 하드와 동일하게 취급" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md || echo "(옛 주석 미잔존 — OK)"
grep -n "soft 엣지에 순환\|hard 엣지에 순환" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 분리 변수 등장, 옛 주석 미잔존, cycle 두 정책 모두 등장.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
feat(auto-epic): deps 파서 hard/soft 분리 + cycle 정책 분기

§2-3 본문 재작성 — v1 에서 동일 처리하던 hard/soft 를 v1.11.0+
부터 분리:
- hard_edges: 위상정렬 입력
- soft_edges: soft_predecessors 테이블로 advisory 보관
- cycle 검사도 분리: hard cycle 즉시 중단, soft-only cycle 정보성

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: §2-4 실행 플랜 미리 보고 — soft advisory 라인 추가

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 112~129)

- [ ] **Step 1: 현재 §2-4 미리 보고 형식 확인**

```bash
sed -n '112,129p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 마크다운 코드 블록 안에 Level 1·2·3 예시 + 모드/Fan-in 라인.

- [ ] **Step 2: Level 출력 예시 + 보충 설명에 soft advisory 라인 삽입**

`old_string`:
````
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
````

`new_string`:
````
- 총 Story: 7 개 (완료 2, 실행 대상 5)
- 완료된 Story (skip): E1-S1, E1-S2
- Level 1 (병렬 3): E1-S3, E1-S4, E1-S5
  └ soft advisory: E1-S5 ← {E2-S1, E4-S1} (architecture 합의 후 진행)
- Level 2 (병렬 2): E1-S6, E2-S1
- Level 3 (단일): E1-S7
- 예상 max 병렬: 3 (`--max-parallel` 3 이하)
- 모드: parallel (또는 sequential)
- Fan-in: 머지 + plan.md 갱신 on (또는 --no-merge off)
- Soft 의존 처리: hard 만 위상정렬 block, soft 는 consumer 측 advisory bullet 으로 surface (v1.11.0+).
```

advisory 라인 규칙:
- 해당 레벨 안의 Story 중 `soft_predecessors[S]` 가 non-empty 인 것만 한 줄씩 들여쓰기 (`  └ ...`) 로 출력.
- 모든 Story 의 soft_predecessors 가 비어 있으면 advisory 라인과 "Soft 의존 처리:" 보충 라인 모두 생략.

- `--interactive` 가 켜져 있으면: `이 플랜으로 진행할까요? (y/N)` 대기.
- 그렇지 않으면 즉시 다음 단계로.
````

- [ ] **Step 3: 검증**

```bash
grep -n "soft advisory: E1-S5\|Soft 의존 처리: hard 만" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 두 라인 모두 등장.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "feat(auto-epic): 실행 플랜 미리 보고에 soft advisory 라인 추가

조건부 — soft_predecessors 가 non-empty 인 Story 만 들여쓰기 한 줄씩.
모든 Story 의 soft 가 비어 있으면 보충 라인 생략.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 3: Step 3-1 사전 캡처에 SOFT_PREDECESSORS 추가

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 169~ Story 별 캡처 블록)

- [ ] **Step 1: 현재 Story 별 블록 확인**

```bash
sed -n '174,184p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: STORY_BRANCH 캡처 블록 + 치환 흐름 설명.

- [ ] **Step 2: STORY_BRANCH 캡처 줄 다음에 SOFT_PREDECESSORS 추가**

`old_string`:
```
   - **Story 별** (각 prompt 치환 시):
     ```bash
     STORY_BRANCH="story/${STORY_ID}-${SLUG}"   # 예: story/E1-S3-design-tokens
     ```

   치환 흐름:
   - `EXPECTED_BASE_SHA` → 각 subagent prompt 의 `<EXPECTED_BASE_SHA>` 자리.
   - `STORY_BRANCH` → 각 subagent prompt 의 `<STORY_BRANCH>` 자리. 가드와 worktree 재유도의 식별자로 쓰이며 plugin 의 branch naming 컨벤션이 안정적 식별자 역할을 한다.
```

`new_string`:
```
   - **Story 별** (각 prompt 치환 시):
     ```bash
     STORY_BRANCH="story/${STORY_ID}-${SLUG}"        # 예: story/E1-S3-design-tokens
     SOFT_PREDECESSORS="$(soft_predecessors[STORY_ID])"   # 예: "E2-S1, E4-S1" 또는 빈 문자열
     ```

   치환 흐름:
   - `EXPECTED_BASE_SHA` → 각 subagent prompt 의 `<EXPECTED_BASE_SHA>` 자리.
   - `STORY_BRANCH` → 각 subagent prompt 의 `<STORY_BRANCH>` 자리. 가드와 worktree 재유도의 식별자로 쓰이며 plugin 의 branch naming 컨벤션이 안정적 식별자 역할을 한다.
   - `SOFT_PREDECESSORS` → consumer Story prompt 의 advisory bullet 자리. **빈 문자열이면 advisory bullet 자체를 prompt 에 넣지 않는다** (조건부 치환 — 불필요 noise 제거).
```

- [ ] **Step 3: 검증**

```bash
grep -n "SOFT_PREDECESSORS=\"\$(soft_predecessors\|조건부 치환 — 불필요 noise" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 두 라인 등장.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "feat(auto-epic): wrapper 사전 캡처에 SOFT_PREDECESSORS 추가

각 Story 별 soft_predecessors 테이블에서 조회. 빈 문자열이면
subagent prompt 의 advisory bullet 을 통째로 생략 (조건부 치환).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 4: Subagent 컨텍스트에 조건부 advisory bullet 추가

**Files:**
- Modify: `commands/auto-epic.md` (Story 브랜치 이름 bullet 직후 — v1.10.0 line 216 부근, line 번호 Task 1·2 후 밀림 가능)

- [ ] **Step 1: 컨텍스트 섹션 마지막 bullet 위치 확인**

```bash
grep -n "Story 브랜치 이름:" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 1건 (v1.10.0 의 STORY_BRANCH bullet).

- [ ] **Step 2: STORY_BRANCH bullet 다음에 조건부 advisory bullet 추가**

`old_string`:
```
- Story 브랜치 이름: `<STORY_BRANCH>` — 가드와 worktree 재유도의 식별자. wrapper 가 dispatch 시점에 `story/<STORY_ID>-<slug>` 로 계산해 주입한다. 본 prompt 안에서 literal 로 사용 (예: `STORY_BRANCH="story/E1-S3-design-tokens"`).

## 필수 산출물
```

`new_string`:
```
- Story 브랜치 이름: `<STORY_BRANCH>` — 가드와 worktree 재유도의 식별자. wrapper 가 dispatch 시점에 `story/<STORY_ID>-<slug>` 로 계산해 주입한다. 본 prompt 안에서 literal 로 사용 (예: `STORY_BRANCH="story/E1-S3-design-tokens"`).
- (**조건부 — `SOFT_PREDECESSORS` 가 non-empty 일 때만 wrapper 가 본 bullet 을 prompt 에 삽입**) Soft 의존 advisory: 선행 Story `<SOFT_PREDECESSORS>` 의 합의 (props/API/스키마 또는 Mock 인터페이스) 가 `docs/architecture/architecture-<NAME>.md` 에 명시되어 있는지 *코드 작성 전* 먼저 확인. 합의 미명시 시 즉시 `STATUS: needs_user | questions: Soft 선행 Story 합의 미명시 (<선행 Story 목록>)` 으로 반환. 합의가 확인되면 정상 진행 — soft 는 위상정렬 블로킹이 아니라 advisory.

## 필수 산출물
```

- [ ] **Step 3: 검증**

```bash
grep -n "Soft 의존 advisory: 선행 Story\|<SOFT_PREDECESSORS>" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: advisory 줄 + `<SOFT_PREDECESSORS>` 자리표시 등장.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
feat(auto-epic): subagent 컨텍스트에 조건부 soft advisory bullet

SOFT_PREDECESSORS 가 non-empty 일 때만 wrapper 가 본 bullet 을 삽입.
합의 미명시 시 STATUS: needs_user 경로 (verify-fail 아님 — 코드 결함이 아니라
사용자 architecture 보강 필요).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: deps 템플릿 범례 갱신

**Files:**
- Modify: `templates/reports/plan/deps.md` (현재 "### 범례" 섹션의 점선 화살표 줄)

- [ ] **Step 1: 현재 범례 줄 위치 확인**

```bash
grep -n "점선 화살표" /Users/nhn/workspace/claude_prac/sdlc-plugin/templates/reports/plan/deps.md
```
Expected: 1건.

- [ ] **Step 2: 점선 줄 교체**

`old_string`:
```
- 점선 화살표: 소프트 의존 (Mock 등으로 우회 가능)
```

`new_string`:
```
- 점선 화살표: 소프트 의존 — 선행 Story 의 *합의/계약* (props/API/스키마 또는 Mock 인터페이스) 만 필요. `/sdlc:auto-epic` v1.11.0+ 위상정렬에서 **블로킹 X**, consumer Story 의 advisory 로만 처리. 합의는 architecture 단계에서 결정해 두어야 함.
```

- [ ] **Step 3: 검증**

```bash
grep -n "v1.11.0+ 위상정렬에서" /Users/nhn/workspace/claude_prac/sdlc-plugin/templates/reports/plan/deps.md
```
Expected: 1건.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add templates/reports/plan/deps.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "docs(deps-template): 소프트 의존 의미를 합의/계약으로 확장

기존 'Mock 등으로 우회 가능' 단일 표현을 합의/계약 (props/API/스키마
또는 Mock 인터페이스) + auto-epic v1.11.0+ 동작 (블로킹 X, advisory)
로 확장 표기.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

## Task 6: plugin.json + marketplace.json 버전 v1.11.0 동시 bump

**Files:**
- Modify: `.claude-plugin/plugin.json`
- Modify: `.claude-plugin/marketplace.json`

- [ ] **Step 1: plugin.json version 변경**

`old_string`:
```
  "version": "1.10.0",
```

`new_string`:
```
  "version": "1.11.0",
```

- [ ] **Step 2: marketplace.json version 변경**

`old_string`:
```
      "version": "1.10.0"
```

`new_string`:
```
      "version": "1.11.0"
```

- [ ] **Step 3: 검증**

```bash
grep '"version"' /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/plugin.json /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/marketplace.json
```
Expected: 두 파일 모두 `1.11.0`.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "chore(release): bump version 1.10.0 → 1.11.0"
```

---

## Task 7: README Changelog v1.11.0 항목 추가

**Files:**
- Modify: `README.md` (현재 v1.10.0 항목 위에 v1.11.0 삽입)

- [ ] **Step 1: 현재 v1.10.0 항목 위치 확인**

```bash
grep -n "^- \*\*v1\.10\.0\*\*" /Users/nhn/workspace/claude_prac/sdlc-plugin/README.md
```
Expected: 1건.

- [ ] **Step 2: v1.10.0 위에 v1.11.0 삽입**

`old_string`:
```
- **v1.10.0** — `/sdlc:auto-epic` 의 cwd 가드
```

`new_string`:
```
- **v1.11.0** — `/sdlc:auto-epic` 의 deps 파서·위상정렬을 hard/soft 의존 분리 처리 (핸드오프 A8 대응): (1) **Parser 분리** — mermaid `-->` (실선) 는 `hard_edges`, `-.->` (점선) 는 `soft_edges` 로 별도 set 보관. v1 에서 동일 처리하던 정책 종결. (2) **위상정렬 변경** — Kahn's algorithm 입력은 `hard_edges` **만**. soft 는 위상정렬 블로킹 X. soft consumer Story 가 같은 레벨 병렬 dispatch 가능 — 핸드오프 사례 (E1-S5 재사용 컴포넌트 props → E2-S1·E4-S1 합의만 필요) 같은 케이스의 병렬화 기회 확보. (3) **Cycle 정책 분리** — hard cycle 은 즉시 중단 (기존), soft-only cycle 은 정보성 1줄 출력 후 계속. (4) **Advisory surface 2지점** — 실행 플랜 미리 보고에 조건부 soft advisory 라인 (`└ soft advisory: X ← {Y, Z}`), subagent prompt 컨텍스트에 조건부 advisory bullet (`SOFT_PREDECESSORS` 가 non-empty 일 때만 wrapper 삽입). 합의 미명시 시 `STATUS: needs_user` 경로. (5) `templates/reports/plan/deps.md` 범례에서 소프트 의존 의미 확장 (Mock 우회만 → 합의/계약 + Mock 인터페이스 + auto-epic 블로킹 X 명시). 기존 deps.md 파일은 그대로 사용 가능 (정책 변경만 — breakage 없음, 병렬화 가능).
- **v1.10.0** — `/sdlc:auto-epic` 의 cwd 가드
```

- [ ] **Step 3: 검증**

```bash
grep -n "^- \*\*v1\.11\.0\*\*\|^- \*\*v1\.10\.0\*\*" /Users/nhn/workspace/claude_prac/sdlc-plugin/README.md
```
Expected: v1.11.0 라인 < v1.10.0 라인 (v1.11.0 위에 위치).

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add README.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "docs(readme): v1.11.0 changelog — soft deps 위상정렬 분리"
```

---

## Task 8: 통합 점검

**Files:** 없음 (read-only 확인)

- [ ] **Step 1: 전체 변경 파일 + 커밋 확인**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin log --oneline -10
```
Expected: spec 커밋 1건 + plan 커밋 1건 + Task 1-7 커밋 7건 = 9 커밋 추가.

- [ ] **Step 2: spec §3 변경 상세 6개 항목 모두 반영 확인**

```bash
echo "=== §3-1 hard/soft 분리 ==="
grep -c "hard_edges\|soft_edges" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-1 cycle 분리 정책 ==="
grep -c "hard 엣지에 순환\|soft 엣지에 순환" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-2 미리 보고 advisory 라인 ==="
grep -c "soft advisory: E1-S5\|Soft 의존 처리: hard 만" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-3 wrapper SOFT_PREDECESSORS 캡처 ==="
grep -c "SOFT_PREDECESSORS=" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-4 subagent advisory bullet ==="
grep -c "Soft 의존 advisory: 선행 Story" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== §3-5 deps 템플릿 범례 ==="
grep -c "v1.11.0+ 위상정렬에서" /Users/nhn/workspace/claude_prac/sdlc-plugin/templates/reports/plan/deps.md
echo "=== §3-6 버전 v1.11.0 ==="
grep '"1.11.0"' /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/plugin.json /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/marketplace.json
echo "=== README v1.11.0 항목 ==="
grep -c "^- \*\*v1\.11\.0\*\*" /Users/nhn/workspace/claude_prac/sdlc-plugin/README.md
```
Expected: 모두 ≥ 1 / "1.11.0" 두 파일 매칭 / README 1건.

- [ ] **Step 3: 회귀 점검 — v1.10.0 영역 미변경**

```bash
echo "=== v1.10.0 cwd 가드 잔존 ==="
grep -c "## 작업 컨텍스트 가드\|cwd-guard-violated\|git worktree list --porcelain" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== v1.9.0 STATUS 매트릭스 잔존 ==="
grep -c "completed-degraded\|base-stale\|verify-env-skip" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
echo "=== 자동 reset 절차 잔존 ==="
grep -c "옵션 (a) 자동 reset 절차" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 모두 ≥ 1 (이전 PR 결과물 그대로 보존).

- [ ] **Step 4: 변경된 §2-3·§2-4 직접 통람 (시각 확인)**

```
Read commands/auto-epic.md (line 95~130 정도) — 마크다운 nesting 깨짐 없는지
Read commands/auto-epic.md (line 215~225 정도) — 컨텍스트 advisory bullet 포맷
```

- [ ] **Step 5: 푸시 안내 (사용자 결정)**

본 plan 은 푸시를 자동 수행하지 않는다. 사용자가 확인 후 `git push origin main` 직접 호출.

---

## Self-Review Notes

본 plan 작성 후 spec 대비 점검:

- **Spec §3-1 (deps 파싱 분리 + cycle 분기)**: Task 1. ✅
- **Spec §3-2 (실행 플랜 미리 보고 advisory)**: Task 2. ✅
- **Spec §3-3 (wrapper SOFT_PREDECESSORS 캡처)**: Task 3. ✅
- **Spec §3-4 (subagent 조건부 advisory bullet)**: Task 4. ✅
- **Spec §3-5 (deps 템플릿 범례)**: Task 5. ✅
- **Spec §3-6 (버전 bump + changelog)**: Task 6 + Task 7. ✅
- **Spec §4 (호환성 backward compat)**: Task 8 Step 3 의 v1.10.0 영역 회귀 점검으로 확인. ✅
- **Spec §5 (검증 시나리오 1-8)**: Task 8 Step 2·3 의 grep 매트릭스 + Step 4 시각 확인. ✅

타입/명명 정합성:
- `hard_edges` / `soft_edges` / `soft_predecessors[S]` — Task 1 정의 → Task 3·4 사용. ✅
- `SOFT_PREDECESSORS` (env var 명) → `<SOFT_PREDECESSORS>` (placeholder) — v1.10.0 의 STORY_BRANCH 패턴과 동일. ✅
- v1.11.0 — 모든 task 에서 동일 표기. ✅
- Soft advisory 미준수 시 STATUS — Task 4 prompt 의 `STATUS: needs_user` 와 spec §3-4 일치 (verify-fail 아님). ✅
