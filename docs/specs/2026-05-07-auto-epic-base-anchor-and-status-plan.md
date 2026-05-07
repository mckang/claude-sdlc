# auto-epic base anchor + STATUS 표준 확장 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/sdlc:auto-epic` 의 worktree base stale 사고를 명시 SHA 기반 브랜치 생성으로 제거하고, 후속 가드의 기반이 될 STATUS reason 표준 코드 매트릭스를 도입한다.

**Architecture:** 마크다운 프로시저 수정 + 템플릿 보강. 코드 변경 없이 `commands/auto-epic.md` 의 dispatch 절차 + 판정 정책 표 + subagent 프롬프트 템플릿을 갱신, `templates/phases/story/verify.md` 에 degraded 섹션 골격 추가, plugin/marketplace 버전 v1.9.0 으로 동시 bump.

**Tech Stack:** Markdown (Claude 프로시저), git 표준 명령 (`git rev-parse`, `git checkout -b <branch> <SHA>`), JSON (plugin metadata)

**Spec:** [docs/specs/2026-05-07-auto-epic-base-anchor-and-status-design.md](./2026-05-07-auto-epic-base-anchor-and-status-design.md)

---

## 파일 구조

| 파일 | 작업 |
|------|------|
| `commands/auto-epic.md` | **수정** — Step 3 dispatch 절차에 EXPECTED_BASE_SHA 캡처/주입, 사후검증 안전망. Subagent 프롬프트 템플릿의 컨텍스트 + 필수 산출물 1번. 판정 정책 섹션을 표준 STATUS 매트릭스로 교체. 에러 처리 섹션의 protocol-violation 항목 reason 코드화. |
| `templates/phases/story/verify.md` | **수정** — 환경 제약 skip 검증 표 (degraded 섹션) 추가 |
| `.claude-plugin/plugin.json` | **수정** — version `1.8.0` → `1.9.0` |
| `.claude-plugin/marketplace.json` | **수정** — version `1.8.0` → `1.9.0` |
| `README.md` | **수정** — Changelog 에 v1.9.0 항목 추가 |

`templates/CLAUDE.md` 등 사용자 프로젝트로 복사되는 파일은 본 PR 에서 변경 없음 (사용자 프로젝트는 v1.8.0 시기에 설치된 CLAUDE.md 를 그대로 쓰므로 backward 호환).

---

## Task 1: STATUS 표준 매트릭스 — 판정 정책 섹션 교체

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 215~226 의 "## 판정 정책" 섹션)

- [ ] **Step 1: 현재 "판정 정책" 섹션 정확히 확인**

```bash
sed -n '215,230p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```

확인할 현재 형태:
```
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

- [ ] **Step 2: 위 섹션을 새 표 포맷으로 Edit 교체**

`old_string` 은 위 Step 1 에서 확인한 블록 전체 (`## 판정 정책` 부터 `반환 형식` 단락 끝까지, 즉 line 215~226 의 본문). `new_string`:

```markdown
## 판정 정책 — STATUS 라인 표준

각 subagent 는 **마지막 줄을 반드시 단일 `STATUS: ...` 라인으로 종료**해야 한다. 표의 reason 코드 외 자유 서술 reason 도 backward compat 으로 허용 — wrapper 는 사용자 개입 정책으로 처리.

| STATUS | 추가 필드 / reason | 발생 조건 | wrapper 정책 |
|---|---|---|---|
| `needs_user` | `questions: <요약>` | Kickoff `## ⚠️ 확인 필요 사항` 1 건 이상 (코드 작성 전 즉시 반환) | 사용자 (a)/(b)/(c) 옵션 제시 |
| `completed` | `branch: story/<ID>-<slug> \| commits: <N>` | verify ✅ PASS + complete 정상 | 정상 fan-in |
| `completed-forced` | `... \| unresolved: <요약>` | verify 🟡 CONDITIONAL PASS 또는 미해결 DoD (알려진 미완 complete.md 기록 후 강제 complete) | 사용자 알림 후 fan-in |
| `completed-degraded` | `... \| degraded: verify-env-skip:<tool>` | verify 도구가 환경 충돌 (중첩 설정 walk-up 등) 로 skip — 코드 결함 아님 | fan-in + release-gate / retro 에서 재검증 |
| `failed` | `reason: base-stale \| expected: <SHA> \| actual: <SHA>` | (안전망) base anchor 불일치 — 후속 PR 의 가드가 트리거 | wrapper 가 fresh dispatch 1회 자동 재시도 |
| `failed` | `reason: cwd-guard-violated` | (자리표시) 후속 PR 의 cwd 가드 위반 | wrapper 가 retry 1회 후 사용자 |
| `failed` | `reason: verify-fail:<tool>` | verify ❌ FAIL — 코드 결함 | 사용자 개입 (커밋 금지, 강제 complete 금지) |
| `failed` | `reason: protocol-violation` | STATUS 라인 누락/형식 오류 | 사용자 개입 |
| `failed` | `reason: <자유 서술>` | 그 외 (backward compat) | 사용자 개입 |

> 본 표의 `cwd-guard-violated` 는 후속 PR (A1 cwd 가드) 가 채울 자리표시. 본 PR 시점에서는 코드로 발생하지 않는다.

## 반환 형식
마지막 줄을 위 표 중 하나의 단일 `STATUS: ...` 라인으로 끝내세요. 그 앞쪽은 요약 자유 서술 (변경 파일, 커밋 해시, 테스트 수 등).
```

- [ ] **Step 3: 변경 검증 — 새 표 존재 + 옛 형태 미잔존**

```bash
grep -c "completed-degraded" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
grep -c "verify-env-skip" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
grep -c "base-stale" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 각각 1 이상 (표에 1회씩 등장).

```bash
grep -n "verify ✅ PASS → complete 진행" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 출력 없음 (옛 bullet 형태 제거됨).

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
feat(auto-epic): STATUS 라인 표준 매트릭스 도입

기존 4-등급 자유 서술 reason 을 reason 코드 표준 매트릭스로 재작성:
- completed-degraded 신규 등급 (verify-env-skip:<tool>)
- failed 의 reason 표준 코드: base-stale, cwd-guard-violated(자리),
  verify-fail:<tool>, protocol-violation
- backward compat: 자유 서술 reason 도 사용자 개입 경로로 허용

후속 PR (A1 cwd 가드, A3 환경 충돌 detection) 의 기반.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: 에러 처리 섹션의 protocol-violation reason 코드 정합화

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 366)

- [ ] **Step 1: 현재 라인 확인**

```bash
grep -n "STATUS:.*라인 없이" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: line 366 부근에 `subagent 가 STATUS: 라인 없이 반환 → failed 로 취급, reason 에 "프로토콜 위반" 기록`.

- [ ] **Step 2: Edit 으로 reason 표준 코드화**

`old_string`:
```
- subagent 가 `STATUS:` 라인 없이 반환 → `failed` 로 취급, reason 에 "프로토콜 위반" 기록
```

`new_string`:
```
- subagent 가 `STATUS:` 라인 없이 반환 또는 형식 오류 → `STATUS: failed | reason: protocol-violation` 으로 취급 (Task 1 의 표 참조)
```

- [ ] **Step 3: 검증**

```bash
grep -n "protocol-violation" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 2건 (Task 1 의 표 + 본 라인).

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
docs(auto-epic): 에러 처리의 프로토콜 위반을 reason 코드로 정합화

STATUS 표준 매트릭스의 protocol-violation 코드와 일치시켜
wrapper 의 reason 파싱 로직이 단일 분기로 처리되도록 수정.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Subagent 프롬프트 템플릿 — 컨텍스트에 EXPECTED_BASE_SHA 추가

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 195~200 부근, "## 컨텍스트" 섹션)

- [ ] **Step 1: 현재 컨텍스트 섹션 확인**

```bash
sed -n '194,201p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 다음 형태로 시작.
```
## 컨텍스트
- Plan 파일: <PLAN_ABSOLUTE_PATH>
- 이 Story 섹션은 ...
- Feature 이름: <NAME>
- 관련 문서 ...
- 참고 인스트럭션: ...
```

- [ ] **Step 2: 컨텍스트 섹션의 마지막 bullet 뒤에 EXPECTED_BASE_SHA bullet 추가**

`old_string` (확정성을 위해 마지막 bullet 부터 다음 빈 줄까지 포함):
```
- 참고 인스트럭션: `commands/story.md` 의 3-A·3-B·3-C 절과 `commands/auto-story.md` 의 2~3 단계. 이 내용을 이 worktree 안에서 **동일하게** 수행하세요. 단 아래 "금지 사항" 은 절대 위반하지 마세요.

## 필수 산출물
```

`new_string`:
```
- 참고 인스트럭션: `commands/story.md` 의 3-A·3-B·3-C 절과 `commands/auto-story.md` 의 2~3 단계. 이 내용을 이 worktree 안에서 **동일하게** 수행하세요. 단 아래 "금지 사항" 은 절대 위반하지 마세요.
- 기준 SHA: `<EXPECTED_BASE_SHA>` — Story 브랜치의 base 로 사용. wrapper 가 dispatch 직전 `git rev-parse main` 으로 캡처한 main HEAD. worktree 의 현재 HEAD 가 stale 일 수 있으므로 이 값을 직접 사용하세요.

## 필수 산출물
```

- [ ] **Step 3: 검증**

```bash
grep -n "EXPECTED_BASE_SHA" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 최소 1건 (컨텍스트 섹션) — Task 4·5 후 추가됨.

- [ ] **Step 4: 커밋 (Task 4 와 묶음 가능 — 끝까지 진행 후 한 번에 커밋해도 됨)**

본 Task 만으로 커밋:
```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "feat(auto-epic): 프롬프트 컨텍스트에 EXPECTED_BASE_SHA 주입 변수 추가"
```

---

## Task 4: Subagent 프롬프트 — 필수 산출물 1번을 명시 SHA 기반 브랜치 생성으로 변경

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 203 부근)

- [ ] **Step 1: 현재 산출물 1번 확인**

```bash
sed -n '202,208p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected:
```
## 필수 산출물
1. `story/<STORY_ID>-<kebab-slug>` 브랜치를 main 기반으로 생성하고 이 브랜치에서 작업 (worktree 루트에서 `git checkout -b ...`).
```

- [ ] **Step 2: Edit 으로 명시 SHA 기반 생성으로 교체**

`old_string`:
```
1. `story/<STORY_ID>-<kebab-slug>` 브랜치를 main 기반으로 생성하고 이 브랜치에서 작업 (worktree 루트에서 `git checkout -b ...`).
```

`new_string`:
````
1. `story/<STORY_ID>-<kebab-slug>` 브랜치를 위 컨텍스트의 `<EXPECTED_BASE_SHA>` 를 base 로 **명시 생성**:
   ```bash
   git checkout -b story/<STORY_ID>-<slug> <EXPECTED_BASE_SHA>
   ```
   `Agent isolation: "worktree"` 가 만들어주는 worktree 의 현재 HEAD 가 wrapper 의 main HEAD 와 다를 수 있으므로 (stale base 가능성), `main` 이 아닌 SHA 를 직접 인자로 사용. 이 단계가 실패하면 (예: `<EXPECTED_BASE_SHA>` 가 worktree 에서 보이지 않음) `STATUS: failed | reason: base-stale | expected: <EXPECTED_BASE_SHA> | actual: $(git rev-parse HEAD)` 로 즉시 반환.
````

- [ ] **Step 3: 검증**

```bash
grep -n "checkout -b story" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 새 명령이 산출물 1번 안에 등장.

```bash
grep -n "main 기반으로 생성" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 출력 없음 (옛 표현 제거).

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
feat(auto-epic): 명시 SHA 기반 Story 브랜치 생성으로 base anchor 보장

worktree base stale 사고를 능동적으로 차단:
- `git checkout -b story/... <EXPECTED_BASE_SHA>` — wrapper 의도 base 에 anchor
- 실패 시 STATUS: failed | reason: base-stale (자체 회수 시도 X)

cherry-pick 회수 비용을 사후 검증·재실행으로 대체.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Wrapper 측 EXPECTED_BASE_SHA 캡처 + 주입 절차 추가

**Files:**
- Modify: `commands/auto-epic.md` (현재 line 165~189 부근, "Step 3. 레벨별 Fan-out (parallel 모드)" 안)

- [ ] **Step 1: 현재 Step 3 의 dispatch 시작 부분 확인**

```bash
sed -n '165,189p' /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: "1. 레벨 안의 Story 수 > `--max-parallel` ..." 부터 Agent 호출 예시 + `isolation: "worktree"` 설명.

- [ ] **Step 2: Step 3 의 dispatch 절차에 "0. 사전 캡처" 단계 삽입**

`old_string`:
```
`--sequential` 이 꺼져 있으면 각 레벨마다:

1. 레벨 안의 Story 수 > `--max-parallel` 이면: 앞에서부터 N 개씩 **슬라이스 배치** (배치 완료 후 다음 배치).
2. 한 배치의 모든 Story 를 **단일 메시지 안에서** `Agent` 복수 호출 (진짜 병렬):
```

`new_string`:
````
`--sequential` 이 꺼져 있으면 각 레벨마다:

1. **사전 캡처 (배치 dispatch 직전)**: wrapper 가 다음 두 SHA 를 캡처한다.
   ```bash
   EXPECTED_BASE_SHA=$(git rev-parse main)
   MAIN_BEFORE=$(git rev-parse main)   # 본 PR 시점에서는 EXPECTED_BASE_SHA 와 동일, Step 4 의 사후검증용으로 별도 변수 유지
   ```
   `EXPECTED_BASE_SHA` 는 다음 단계 prompt 치환 시 각 subagent 의 `<EXPECTED_BASE_SHA>` 자리에 그대로 들어간다 (배치 안의 모든 Story 가 같은 값 공유 — 같은 dispatch 시점).
2. 레벨 안의 Story 수 > `--max-parallel` 이면: 앞에서부터 N 개씩 **슬라이스 배치** (배치 완료 후 다음 배치).
3. 한 배치의 모든 Story 를 **단일 메시지 안에서** `Agent` 복수 호출 (진짜 병렬):
````

- [ ] **Step 3: 같은 섹션 안의 옛 번호 (2 → 3, 3 → 4) 정합화**

`old_string` (Agent 호출 예시 블록 직후):
```
3. **결과 수집**: 모든 `Agent` 결과 수신 후 각 결과의 마지막 `STATUS:` 라인을 파싱.
```

`new_string`:
```
4. **결과 수집 + 사후검증**: 모든 `Agent` 결과 수신 후
   - 각 결과의 마지막 `STATUS:` 라인을 파싱.
   - **사후검증 안전망**:
     ```bash
     MAIN_AFTER=$(git rev-parse main)
     ```
     `MAIN_BEFORE` 와 다르면 (즉 dispatch 동안 main HEAD 가 변동) — subagent 의 가드 우회 또는 미배포 가드 환경에서 main 직접 commit 가능성. 다음 알림을 출력하고 사용자에게 옵션 제시:
     ```markdown
     ⚠️ main HEAD 가 dispatch 동안 변동되었습니다.
        BEFORE: <MAIN_BEFORE>
        AFTER:  <MAIN_AFTER>
        새로 생긴 commit: <git log MAIN_BEFORE..MAIN_AFTER --oneline>

     다음 옵션 중 선택:
     - (a) main 을 BEFORE 로 자동 reset (story 브랜치는 보존) [본 PR 미구현 — 사용자 수동]
     - (b) 수동 검토 (이 Epic 중단)
     ```
     본 PR 시점에서는 자동 reset 미구현 — 사용자 수동 처리. 자동 reset 은 후속 PR (destructive 동작 검토 후).
```

- [ ] **Step 4: 검증**

```bash
grep -n "EXPECTED_BASE_SHA=\$(git rev-parse main)" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
grep -n "MAIN_BEFORE\|MAIN_AFTER" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
```
Expected: 각 1건 이상.

- [ ] **Step 5: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add commands/auto-epic.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
feat(auto-epic): wrapper 측 EXPECTED_BASE_SHA 캡처 + 사후검증 안전망

- 배치 dispatch 직전 EXPECTED_BASE_SHA = git rev-parse main 캡처
  → subagent prompt 의 <EXPECTED_BASE_SHA> 치환에 사용 (Task 3·4 와 연결)
- dispatch 직후 MAIN_BEFORE/AFTER 비교, 변동 시 사용자 알림 + 옵션 제시
  자동 reset 은 destructive 라 본 PR 미구현 (사용자 수동 처리)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: verify.md 템플릿 — degraded 섹션 골격 추가

**Files:**
- Modify: `templates/phases/story/verify.md` (현재 line 67 의 "## 4. DoD 점검" 섹션 다음)

- [ ] **Step 1: 현재 line 67 부근 (4 → 5 섹션 사이) 확인**

```bash
sed -n '65,72p' /Users/nhn/workspace/claude_prac/sdlc-plugin/templates/phases/story/verify.md
```
Expected:
```
- [ ] 성능 기준 충족 — 측정 안 함 (NFR 인증 p95 500ms)
```
(섹션 4 의 마지막 bullet) 직후 빈 줄, 그 다음 `## 5. 표준 체크리스트 (자동)`.

- [ ] **Step 2: 4번 섹션과 5번 섹션 사이에 신규 섹션 (4.5) 삽입**

`old_string`:
````
- [ ] 성능 기준 충족 — 측정 안 함 (NFR 인증 p95 500ms)
```

## 5. 표준 체크리스트 (자동)
````

`new_string`:
````
- [ ] 성능 기준 충족 — 측정 안 함 (NFR 인증 p95 500ms)
```

## 4.5. 환경 제약으로 skip 된 검증 (해당 시)

verify 도구가 코드 결함이 아닌 **환경/설정 충돌** (예: 부모 디렉토리 설정 walk-up, 중첩 config 충돌) 로 실패한 경우 자체 우회 시도 X. 아래 표에 기록 후 STATUS 를 `completed-degraded` 로 반환한다.

```markdown
| 도구 | 환경 충돌 reason | 사후 책임 |
|---|---|---|
| <tool 식별자> | <한 줄 요약 — 출력의 "duplicate"/"loaded twice"/"conflict with parent" 등 환경 패턴> | release-gate / retro 재검증 |
```

본 표가 비어 있으면 STATUS 는 일반 (`completed` / `completed-forced` / `failed`) 중 하나. 비어 있지 않으면 반드시 `completed-degraded`.

판정 기준 (subagent 가 환경 충돌인지 코드 결함인지 구분):
- **환경 충돌 후보**: 도구 출력에 "duplicate", "loaded twice", "conflict with parent", "ambiguous" 등 명시적 환경 패턴 + 동일 명령이 main worktree (parent) 에서 정상 동작.
- **코드 결함**: 위 외 (테스트 실패 메시지, lint 규칙 위반 등) — `STATUS: failed | reason: verify-fail:<tool>`.

## 5. 표준 체크리스트 (자동)
````

- [ ] **Step 3: 검증**

```bash
grep -n "## 4.5\| degraded\|environment 충돌\|환경 제약으로 skip" /Users/nhn/workspace/claude_prac/sdlc-plugin/templates/phases/story/verify.md
```
Expected: 각 항목 등장.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add templates/phases/story/verify.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "$(cat <<'EOF'
feat(verify): 환경 제약 skip 검증 섹션 (4.5) 골격 추가

verify 도구의 환경 충돌(중첩 설정 walk-up 등)로 실패한 경우를
코드 결함과 분리해 표로 기록. STATUS: completed-degraded 등급의
근거 자료가 됨. 환경/코드 판정 기준도 한 줄씩 명시.

특정 도구 (eslint/pyproject 등) 워크어라운드는 미포함 — 범용 가이드만.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: plugin.json + marketplace.json 버전 v1.9.0 동시 bump

**Files:**
- Modify: `.claude-plugin/plugin.json` (line 3)
- Modify: `.claude-plugin/marketplace.json` (line 10)

CLAUDE.md 규약: "편집 후 반드시 plugin.json + marketplace.json 버전 동시 bump".

- [ ] **Step 1: plugin.json version 변경**

`old_string`:
```
  "version": "1.8.0",
```

`new_string`:
```
  "version": "1.9.0",
```

- [ ] **Step 2: marketplace.json version 변경**

`old_string`:
```
      "version": "1.8.0"
```

`new_string`:
```
      "version": "1.9.0"
```

- [ ] **Step 3: 검증 — 두 파일 동기화 확인**

```bash
grep '"version"' /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/plugin.json /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/marketplace.json
```
Expected: 두 파일 모두 `1.9.0`.

- [ ] **Step 4: 커밋 (Task 8 의 README 변경 후 한 번에 묶어도 됨 — 본 plan 에서는 분리 커밋)**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "chore(release): bump version 1.8.0 → 1.9.0"
```

---

## Task 8: README Changelog 항목 추가

**Files:**
- Modify: `README.md` (현재 line 228 직전 — 가장 최신 v1.8.0 항목 위에 v1.9.0 삽입)

- [ ] **Step 1: 현재 v1.8.0 항목 위치 확인**

```bash
grep -n "^- \*\*v1\.8\.0\*\*" /Users/nhn/workspace/claude_prac/sdlc-plugin/README.md
```
Expected: line 228 (또는 근접) 에 v1.8.0 항목.

- [ ] **Step 2: v1.8.0 항목 위에 v1.9.0 항목 삽입**

`old_string` (확정성 위해 v1.8.0 라인 시작 ~10자만 사용):
```
- **v1.8.0** — Post-completion
```

`new_string`:
```
- **v1.9.0** — `/sdlc:auto-epic` 의 worktree base stale 사고 차단 + STATUS 라인 표준 매트릭스 도입: (1) **Base anchor** — subagent 가 `git checkout -b story/... <EXPECTED_BASE_SHA>` 로 wrapper 의 main HEAD SHA 에 명시 anchor. wrapper 가 dispatch 직전 `git rev-parse main` 으로 캡처해 prompt 에 주입. worktree 의 현재 HEAD 가 stale 이어도 사고 자체가 발생하지 않음. (2) **STATUS 표준 매트릭스** — 기존 4-등급 (`needs_user`/`completed`/`completed-forced`/`failed`) 의 reason 자유 서술을 표준 코드 매트릭스로 재작성. 신규 등급 `completed-degraded` (verify-env-skip:<tool>) + 표준 reason 코드 (`base-stale`, `cwd-guard-violated` 자리표시, `verify-fail:<tool>`, `protocol-violation`). backward compat 유지. (3) **wrapper 사후검증 안전망** — dispatch 전후 main HEAD SHA 비교, 변동 시 사용자 알림 + 옵션 (자동 reset 은 다음 PR). (4) `templates/phases/story/verify.md` 에 §4.5 "환경 제약으로 skip 된 검증" 섹션 + 환경/코드 결함 판정 기준 추가. 후속 PR (cwd 가드 본체, 환경 충돌 detection 가이드, soft deps 위상정렬) 의 기반.
- **v1.8.0** — Post-completion
```

- [ ] **Step 3: 검증**

```bash
grep -n "^- \*\*v1\.9\.0\*\*" /Users/nhn/workspace/claude_prac/sdlc-plugin/README.md
```
Expected: 1건, line 228 직전.

- [ ] **Step 4: 커밋**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin add README.md
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin commit -m "docs(readme): v1.9.0 changelog — base anchor + STATUS 표준 매트릭스"
```

---

## Task 9: 최종 통합 점검

**Files:** 없음 (read-only 확인)

- [ ] **Step 1: 전체 변경 파일 + 커밋 확인**

```bash
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin log --oneline -10
git -C /Users/nhn/workspace/claude_prac/sdlc-plugin diff main --stat HEAD~8
```
Expected: 8 커밋 (Task 1-8), 5 파일 변경.

- [ ] **Step 2: spec 의 변경 상세 5개 항목 모두 반영 확인**

```bash
# 3-1 EXPECTED_BASE_SHA 주입
grep -c "EXPECTED_BASE_SHA" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
# 3-2 STATUS 표준 매트릭스
grep -c "completed-degraded\|verify-env-skip\|base-stale\|cwd-guard-violated\|verify-fail" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
# 3-3 wrapper 사후검증
grep -c "MAIN_BEFORE\|MAIN_AFTER" /Users/nhn/workspace/claude_prac/sdlc-plugin/commands/auto-epic.md
# 3-4 verify.md degraded 섹션
grep -c "환경 제약으로 skip" /Users/nhn/workspace/claude_prac/sdlc-plugin/templates/phases/story/verify.md
# 버전 v1.9.0
grep '"1.9.0"' /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/plugin.json /Users/nhn/workspace/claude_prac/sdlc-plugin/.claude-plugin/marketplace.json
```
Expected: 모든 항목 1 이상 / "1.9.0" 매칭 2건.

- [ ] **Step 3: 변경된 auto-epic.md 의 STATUS 표준 표를 직접 Read 로 한 번 통람 — 표 컬럼 정렬, 백틱 escape, 줄바꿈 깨짐 없는지 시각 확인**

```
Read commands/auto-epic.md (line 215~245 정도)
```

- [ ] **Step 4: 회귀 검증 시나리오 — 메모만 (실제 dispatch 는 본 PR 범위 밖)**

본 PR 의 명목적 합격 기준 (spec §5):
1. ✅ `git checkout -b story/... <EXPECTED_BASE_SHA>` 가 subagent 프롬프트에 등장 (Task 4)
2. ✅ STATUS 매트릭스가 5개 신규 코드 + backward compat 라인을 모두 포함 (Task 1)
3. ✅ wrapper 사후검증 알림 절차가 Step 3 안에 등장 (Task 5)
4. ✅ backward compat: 기존 4-등급 라인 형식 그대로 매트릭스 안에 남아 있음 (Task 1)
5. ✅ verify.md 템플릿에 §4.5 섹션 골격 + 비어 있을 시 정책 명시 (Task 6)

실제 dispatch 회귀 (실 worktree 띄워 base stale 시뮬레이션) 는 별도 검증 사이클로 분리 — 본 PR 은 마크다운 정합성까지.

- [ ] **Step 5: 푸시 안내 (사용자 결정)**

본 plan 은 푸시를 자동 수행하지 않는다. 사용자가 `git push origin main` 을 직접 호출.

---

## Self-Review Notes

본 plan 작성 후 spec 대비 점검:

- **Spec §3-1 (EXPECTED_BASE_SHA 주입)**: Task 3 (컨텍스트 bullet) + Task 4 (산출물 1번 명시 SHA 사용) + Task 5 (wrapper 캡처) 로 분할 커버. ✅
- **Spec §3-2 (STATUS 표준)**: Task 1 (표 교체) + Task 2 (에러 처리 정합화). ✅
- **Spec §3-3 (wrapper 사후검증)**: Task 5 후반. 자동 reset 은 spec 도 "사용자 알림까지" 로 명시 → 일치. ✅
- **Spec §3-4 (verify.md degraded 섹션)**: Task 6. ✅
- **Spec §7 (버전 v1.9.0)**: Task 7 (plugin/marketplace) + Task 8 (changelog). ✅
- **Spec §4 (의도적 비포함)**: Task 어디에도 ESLint/pnpm 특정 명령, EXPECTED_WORKTREE export, 자체 회수 코드 없음. ✅
- **Spec §5 (검증 시나리오)**: Task 9 가 마크다운 정합성 ≤ §5 범위 만큼 점검. 실 dispatch 회귀는 PR 범위 밖으로 명시. ✅

타입 정합성:
- `<EXPECTED_BASE_SHA>` placeholder — Task 3·4·5 에서 동일 표기. ✅
- `MAIN_BEFORE` / `MAIN_AFTER` — Task 5 안에서만 등장, 다른 곳과 충돌 없음. ✅
- STATUS 코드 — Task 1 의 표가 single source. Task 2·4·6 모두 표의 코드를 참조. ✅
