# Design Spec: auto-epic base anchor + STATUS 표준 확장

- **작성일**: 2026-05-07
- **상태**: 작성 중 (사용자 검토 대기)
- **관련 커맨드**: `commands/auto-epic.md` (수정)
- **관련 인계 문서**: `temp1/docs/handoffs/sdlc-plugin-hardening.md` (외부 프로젝트)
- **대상 플러그인 버전**: v1.8.0 → v1.9.0

---

## 1. 목적

`/sdlc:auto-epic` 의 병렬 dispatch 환경에서 발견된 두 가지 결함을 plugin 코드의 비-언어/비-툴체인 의존 변경으로 해결한다.

1. **Worktree base stale**: `Agent isolation: "worktree"` 가 만들어 주는 worktree 의 base 가 wrapper dispatch 시점의 main HEAD 와 불일치하는 사례. 결과: subagent 가 stale base 위에서 작업 → fan-in 시 cherry-pick 회수 비용 발생.
2. **STATUS 라인 reason 자유 서술**: 현재 `STATUS: failed | reason: <자유 서술>` 형식이라 wrapper 가 reason 별 정책 분기를 할 수 없음. 후속 가드 (cwd 가드, 환경 충돌 처리 등) 의 기반이 되는 reason 표준이 부재.

이 두 항목은 플러그인이 다양한 언어·툴체인에서 사용된다는 전제 하에 **git 표준 명령만으로 동작** 하도록 설계한다.

---

## 2. 범위

### 포함
- `commands/auto-epic.md` 의 subagent 프롬프트 템플릿에 EXPECTED_BASE_SHA 주입 + 명시 SHA 기반 브랜치 생성
- `commands/auto-epic.md` 의 "판정 정책" 섹션에 STATUS reason 표준 코드 추가 (failed reason + completed-degraded 등급)
- wrapper 의 dispatch 직전 main HEAD SHA 캡처 + dispatch 직후 SHA 검증 (안전망)
- `commands/auto-epic.md` 의 결과 수집 단계에서 새 STATUS 코드별 wrapper 정책 매트릭스 추가
- `templates/phases/story/verify.md` 에 `degraded` 섹션 (환경 제약으로 skip 된 검증 표) 추가

### 제외 (별도 PR)
- A1 cwd 가드 (subagent 측 worktree-list 재유도) — 본 PR 의 STATUS 표준이 머지된 뒤 그 위에 작성
- A3 환경 충돌 graceful degradation 의 *실제 detection 로직* — STATUS 등급만 본 PR 에서 정의, 실제 활용은 후속 PR
- A4 soft deps 위상정렬 분리 — 사고 0 건이라 우선순위 낮음, 별도 트랙

---

## 3. 변경 상세

### 3-1. EXPECTED_BASE_SHA 주입 (A2)

**위치**: `commands/auto-epic.md` Step 3 (레벨별 Fan-out, 현재 line ~165 부근)

**Wrapper 측 추가 책임**:

각 Story 의 `Agent` dispatch 직전:

```bash
EXPECTED_BASE_SHA=$(git rev-parse main)
```

이 값을 subagent prompt 의 컨텍스트 섹션에 치환 변수로 주입.

**Subagent 프롬프트 변경** (현재 line 203 의 "필수 산출물 1번"):

기존:
```markdown
1. `story/<STORY_ID>-<kebab-slug>` 브랜치를 main 기반으로 생성하고 이 브랜치에서 작업
   (worktree 루트에서 `git checkout -b ...`).
```

변경:
```markdown
1. `story/<STORY_ID>-<kebab-slug>` 브랜치를 **<EXPECTED_BASE_SHA> 기반으로 명시 생성**:
     git checkout -b story/<STORY_ID>-<slug> <EXPECTED_BASE_SHA>
   worktree 의 현재 HEAD 가 stale 일 수 있으므로 main 이 아닌 SHA 를 직접 인자로 사용.
```

**효과**: worktree base 가 stale 이든 말든 story 브랜치가 wrapper 의도한 base 에 anchor 됨. 사후 검증·fail-fast 가 불필요해짐 (반응적 → 능동적).

**컨텍스트 섹션에 추가** (현재 line 195 부근):

```markdown
- 기준 SHA: `<EXPECTED_BASE_SHA>` — Story 브랜치의 base 로 사용. 이 값은 wrapper 가 dispatch 직전 `git rev-parse main` 으로 캡처한 main HEAD 입니다.
```

### 3-2. STATUS 라인 reason 표준 (S표준)

**위치**: `commands/auto-epic.md` 의 "판정 정책" 섹션 (현재 line 215~226)

기존 4-등급 (`needs_user`, `completed`, `completed-forced`, `failed`) 에 다음을 추가:

#### 새 등급: `completed-degraded`

```
STATUS: completed-degraded | branch: story/<ID>-<slug> | commits: <N> | degraded: <degraded-reason>
```

`<degraded-reason>` 표준 코드:
- `verify-env-skip:<tool>` — verify 도구가 환경 충돌 (중첩 설정 walk-up 등) 로 skip. `<tool>` 은 자유 식별자 (예: `lint`, `typecheck`).

wrapper 정책: fan-in 머지하되, `docs/release/` 단계 또는 retro 시 degraded 항목 재검증 강제 (별도 PR 에서 release-gate 통합).

#### `failed` 의 reason 표준 코드

| reason | 의미 | wrapper 정책 |
|---|---|---|
| `cwd-guard-violated` | (후속 PR 용 자리표시) cwd 가드 위반 | 자동 retry 1회 후 사용자 |
| `base-stale` | (안전망) base anchor 검증 실패 | 자동 fresh dispatch 재시도 |
| `verify-fail:<tool>` | 코드 결함으로 verify 실패 | 사용자 개입 필수 |
| `protocol-violation` | STATUS 라인 누락/형식 오류 (기존) | 사용자 개입 |
| `<자유 서술>` | 위에 매칭되지 않는 경우 (호환성) | 사용자 개입 |

명시되지 않은 reason 은 기존과 동일하게 자유 서술 허용 (backwards compatibility).

#### 표준 출력 정책 표

`commands/auto-epic.md` line 215 의 "판정 정책" 섹션을 표 형태로 재작성:

```markdown
## 판정 정책 — STATUS 라인 표준

| STATUS | reason / 추가 필드 | 발생 조건 | wrapper 정책 |
|---|---|---|---|
| `needs_user` | `questions: <요약>` | Kickoff 확인 필요 사항 1건+ | 사용자 옵션 제시 |
| `completed` | `branch: ... | commits: N` | verify ✅ + complete 정상 | 정상 fan-in |
| `completed-forced` | `... | unresolved: <요약>` | verify 🟡 또는 미해결 DoD | 사용자 알림 후 fan-in |
| `completed-degraded` | `... | degraded: verify-env-skip:<tool>` | 환경 충돌로 verify skip | fan-in + 후속 release-gate 재검증 |
| `failed` | `reason: base-stale` | 안전망: base anchor 검증 실패 | 자동 fresh dispatch 1회 |
| `failed` | `reason: cwd-guard-violated` | (후속 PR) cwd 가드 위반 | 자동 retry 1회 |
| `failed` | `reason: verify-fail:<tool>` | verify ❌ (코드 결함) | 사용자 개입 |
| `failed` | `reason: protocol-violation` | STATUS 라인 누락/오형식 | 사용자 개입 |
| `failed` | `reason: <자유 서술>` | 그 외 | 사용자 개입 |
```

본 PR 에서는 `cwd-guard-violated` 는 *코드로는 등장하지 않지만 표에 등록* — 후속 PR (A1) 가 이 자리에 들어옴을 명시.

### 3-3. wrapper 사후검증 안전망

**위치**: Step 3 (레벨별 Fan-out) 의 dispatch 호출 직전·직후

추가 로직 (의사코드):

```
for each level:
  MAIN_BEFORE = `git rev-parse main`
  results = Agent.dispatch(level.stories)         # 단일 메시지 안에서 병렬
  MAIN_AFTER = `git rev-parse main`
  if MAIN_BEFORE != MAIN_AFTER:
      # subagent 가 main 에 직접 commit (가드 우회 또는 미배포 가드 환경)
      output:
        ⚠️ main HEAD changed during dispatch (BEFORE=<sha>, AFTER=<sha>).
        다음 옵션 중 선택:
          (a) main 을 BEFORE 로 자동 reset (story 브랜치는 보존)
          (b) 수동 검토 (중단)
      stop and ask user
```

이 안전망은 본 PR 에서는 **사용자 알림까지만** 하고 자동 reset 은 다음 PR 에 미룬다 (destructive 동작은 별도 검토).

### 3-4. verify.md 템플릿 — degraded 섹션

**위치**: `templates/phases/story/verify.md`

기존 verify 섹션 다음에 추가:

```markdown
## 환경 제약으로 skip 된 검증 (있으면 작성)

| 도구 | reason | 사후 책임 |
|---|---|---|
| <tool> | <env-conflict 한 줄 요약> | release-gate 재검증 |

> 본 표가 비어 있지 않으면 STATUS 는 `completed-degraded` 로 반환.
```

본 PR 에서는 표 골격만 추가. 환경 충돌 detection 가이드는 후속 A3 PR.

---

## 4. 비변경 항목 (의도적 제외)

| 항목 | 제외 사유 |
|---|---|
| 특정 도구 우회 (`--no-eslintrc`, `--config` 등) | 범용성 위반. plugin 코드에 도구별 워크어라운드 X. |
| 환경 변수 기반 가드 (`EXPECTED_WORKTREE` export) | Bash tool state 비유지로 동작 불가. literal-injection 또는 worktree-list 재유도로 후속 PR 처리. |
| subagent 자체 회수 (자동 cherry-pick / reset) | 휴먼 검증 비용 ↑. wrapper 안전망으로 대체. |
| A1 cwd 가드 본체 | 본 PR 의 STATUS 표준 머지 후 별도 PR. |
| A3 환경 충돌 detection 로직 | 본 PR 은 등급/템플릿만, detection 가이드는 별도. |

---

## 5. 검증 시나리오

본 PR 의 합격 기준:

1. **Base anchor 동작**: 의도적으로 worktree base 가 stale 인 상태를 만든 후 (예: wrapper 에서 main 을 1 commit 진행시킨 직후 dispatch) `/sdlc:auto-epic` 실행 → story 브랜치의 base 가 wrapper 의 main HEAD 와 일치 (`git merge-base story/... main` == EXPECTED_BASE_SHA).
2. **STATUS reason 매트릭스 표시**: `commands/auto-epic.md` 의 판정 정책 표가 새 코드를 모두 포함. `cwd-guard-violated` 는 자리표시로 등록.
3. **wrapper 사후검증 트리거**: subagent 가 의도적으로 main 에 commit 하도록 변조한 시나리오에서 wrapper 가 MAIN_BEFORE/AFTER 차이를 감지하고 사용자에게 알림.
4. **호환성**: 기존 4-등급 (`needs_user`, `completed`, `completed-forced`, `failed` + 자유 reason) 은 동일하게 동작 (regression 없음).
5. **verify.md 템플릿 골격**: 신규 verify.md 생성 시 degraded 섹션이 비어 있더라도 표 헤더가 포함됨.

---

## 6. 후속 PR 의존 관계

본 PR 머지 후:

- **A1 cwd 가드 PR**: 본 PR 의 STATUS 표 `cwd-guard-violated` 자리에 실제 가드 코드 + worktree-list 재유도 패턴 채움.
- **A3 환경 충돌 detection PR**: degraded 섹션의 detection 가이드 + completed-degraded 자동 분기 활용.
- **wrapper 사후검증 자동 reset PR**: 본 PR 의 알림 단계를 자동 reset (사용자 confirm 옵션 포함) 으로 확장.
- **A4 soft deps PR**: 독립. 본 PR 과 의존 없음.

---

## 7. 버전 정책

본 PR 머지 시:
- `plugin.json` / `marketplace.json`: v1.8.0 → v1.9.0 (minor — 신규 STATUS 등급 + base anchor 동작 변경, 기존 호환 유지).
- `README.md` 변경 로그에 본 spec 링크 추가.
