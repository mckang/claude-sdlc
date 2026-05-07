# Design Spec: auto-epic cwd 가드 본체 + wrapper 자동 reset 확장

- **작성일**: 2026-05-07
- **상태**: 작성 중 (사용자 검토 대기)
- **관련 커맨드**: `commands/auto-epic.md` (수정)
- **선행 PR**: v1.9.0 (base anchor + STATUS 표준 매트릭스) — `cwd-guard-violated` 자리표시 + wrapper 사후검증 알림 단계 마련 완료
- **대상 플러그인 버전**: v1.9.0 → v1.10.0
- **관련 인계 문서**: `temp1/docs/handoffs/sdlc-plugin-hardening.md` (외부 프로젝트)

---

## 1. 목적

`/sdlc:auto-epic` 의 병렬 dispatch 환경에서 관측된 **subagent 의 첫 git 명령이 main worktree 에 라우팅되어 main 에 잘못 commit 되는 사고** (외부 프로젝트에서 5건 발생) 를 두 방향에서 차단한다.

- **예방** (subagent): branch 생성 이후 모든 git/build/test 명령에 worktree-list 재유도 가드 prepend. 가드는 stateless (Bash tool 호출 사이 shell state 비유지 우회) 하며 plugin 컨벤션 `STORY_BRANCH=story/<ID>-<slug>` 을 안정적 식별자로 사용한다.
- **회복** (wrapper): v1.9.0 의 사후검증 알림 단계를 사용자 (y/N) 승인 후 자동 reset 으로 확장. main 이 dispatch 동안 변동된 사고를 1회 명령으로 정리.

본 PR 은 v1.9.0 의 STATUS 표 `cwd-guard-violated` 자리표시를 채우는 후속 작업이다.

---

## 2. 범위

### 포함
- `commands/auto-epic.md` Step 3 사전 캡처에 `STORY_BRANCH` 변수 추가 (각 Story 별).
- `commands/auto-epic.md` subagent 프롬프트 컨텍스트에 `<STORY_BRANCH>` 자리표시 + 적용 범위 명시.
- `commands/auto-epic.md` subagent 프롬프트에 "## 작업 컨텍스트 가드" 섹션 신설 — worktree-list 재유도 가드 코드 + 적용 명령 분류.
- `commands/auto-epic.md` 사후검증 알림 단계 옵션 (a) 의 "[본 PR 미구현]" 표기 제거 + 자동 reset 절차 명시.
- 버전 동시 bump v1.9.0 → v1.10.0.

### 제외 (별도 트랙)
- A3 환경 충돌 detection 가이드 강화 (degraded 등급의 *실제 detection 로직*).
- A4 soft deps 위상정렬 분리.
- 가드 우회 디텍션 (명시 `cd /other/path` 추적 등).
- 비-git 명령 가드 (file write 등 — main 오염으로 직접 이어지지 않음).

---

## 3. 변경 상세

### 3-1. Wrapper Step 3 사전 캡처 — STORY_BRANCH 추가

**위치**: `commands/auto-epic.md` Step 3 의 "1. 사전 캡처 (배치 dispatch 직전)" 블록.

**현재** (v1.9.0):
```bash
EXPECTED_BASE_SHA=$(git rev-parse main)
MAIN_BEFORE=$(git rev-parse main)
```

**변경 후**: 위 값은 *배치* 단위 캡처. STORY_BRANCH 는 *Story* 별 캡처 (loop 내):
```bash
# 배치 dispatch 직전 (배치 안 모든 Story 공유)
EXPECTED_BASE_SHA=$(git rev-parse main)
MAIN_BEFORE=$(git rev-parse main)

# 각 Story 의 prompt 치환 시 (Story 별)
STORY_BRANCH="story/${STORY_ID}-${SLUG}"   # 예: story/E1-S3-design-tokens
```

`STORY_BRANCH` 는 subagent prompt 의 `<STORY_BRANCH>` 자리에 그대로 들어간다.

설명 텍스트 추가:
> `STORY_BRANCH` 는 가드/재유도 식별자로 prompt 안에서 literal 로 등장한다. plugin 의 branch naming 컨벤션이 안정적 식별자 역할.

### 3-2. Subagent 프롬프트 컨텍스트에 STORY_BRANCH 자리표시

**위치**: subagent 프롬프트 템플릿 "## 컨텍스트" 섹션 (v1.9.0 의 EXPECTED_BASE_SHA bullet 다음).

추가 bullet:
```markdown
- Story 브랜치 이름: `<STORY_BRANCH>` — 가드와 worktree 재유도에 사용. wrapper 가 dispatch 시점에 `story/<STORY_ID>-<slug>` 로 계산해 주입한다.
```

### 3-3. 신규 섹션 "## 작업 컨텍스트 가드"

**위치**: subagent 프롬프트의 "## 필수 산출물" 섹션 *직후*, "## 금지 사항" 섹션 *직전*.

이유: 산출물 1번 (branch 생성) 이후의 모든 명령이 적용 대상이라 산출물 정의 후가 자연스러움. 금지 사항 앞에 두어 "이 가드를 우회하지 마세요" 라는 후속 금지 조항이 가드를 reference 가능.

```markdown
## 작업 컨텍스트 가드 (필수)

산출물 1번 (Story 브랜치 생성) 이후의 모든 **git / 빌드 / 테스트 / lint** 명령은 다음 가드를 첫 줄로 prepend 한 뒤 실행하세요. Bash tool 호출 사이에 cwd 가 main worktree 로 라우팅되는 환경 동작이 관측되었으므로, 매 호출에서 **stateless 로 worktree 를 재유도** 합니다.

```bash
WT="$(git worktree list --porcelain | awk '
  /^worktree /{wt=$2}
  /^branch refs\/heads\/'"$STORY_BRANCH"'$/{print wt}
')"
[ -n "$WT" ] && cd "$WT" || {
  echo "STATUS: failed | reason: cwd-guard-violated"
  exit 1
}
```

`$STORY_BRANCH` 는 위 컨텍스트의 `<STORY_BRANCH>` 자리표시 값을 literal 로 그대로 사용 (예: `STORY_BRANCH="story/E1-S3-design-tokens"` 를 매 호출 첫 줄에 명시).

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
```

### 3-4. 금지 사항에 가드 우회 금지 조항 추가

**위치**: subagent 프롬프트 "## 금지 사항" 섹션.

기존 금지 사항 마지막에 추가:
```markdown
- 작업 컨텍스트 가드를 우회하지 마세요. `cd <main repo path>`, `git -C <main repo path>`, 환경변수 우회 (`$STORY_BRANCH` 재정의 등) 모두 금지. 가드 실패 시 자체 회복 시도 X — `STATUS: failed | reason: cwd-guard-violated` 반환만.
```

### 3-5. Wrapper 사후검증 — 옵션 (a) 자동 reset 활성화

**위치**: Step 3 의 "4. 결과 수집 + 사후검증" 의 알림 메시지.

**현재** (v1.9.0):
```
- (a) main 을 BEFORE 로 자동 reset (story 브랜치는 보존) [본 PR 미구현 — 사용자 수동]
- (b) 수동 검토 (이 Epic 중단)
```

**변경 후**:
```markdown
- (a) main 을 BEFORE 로 자동 reset (story 브랜치는 보존)
- (b) 수동 검토 (이 Epic 중단)
```

(즉 "[본 PR 미구현]" 표기 제거.)

옵션 (a) 선택 시 wrapper 의 실제 동작 절차 명문화 (사후검증 블록 안에 추가):

```markdown
**옵션 (a) 자동 reset 절차**:
사용자가 (a) 를 명시 선택한 경우에만 실행 (destructive — 묵시 진행 금지):

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
```

### 3-6. 버전 bump

`.claude-plugin/plugin.json` + `marketplace.json`: v1.9.0 → v1.10.0.
README changelog 항목 추가 (v1.10.0).

---

## 4. 비변경 항목 (의도적 제외)

| 항목 | 제외 사유 |
|---|---|
| Read-only 명령 가드 | 오버헤드 ↑, main 오염 위험 X |
| 가드 우회 디텍션 (`cd /other/path` 자동 추적) | 첫 줄 가드만으로 충분, 추적은 LLM 준수에 의존 |
| 가드 자체 회복 (cherry-pick / reflog) | handoff 5건 모두 자체 회복이 휴먼 검증 비용 ↑ — fail-fast 가 더 안전 |
| 비-git 명령 가드 (file write 등) | git 외에는 cwd 오류가 main 오염으로 직접 이어지지 않음 |
| `STORY_BRANCH` 외 식별 (절대 경로 등) | branch naming 이 plugin 컨벤션 — 안정적 |
| EXPECTED_WORKTREE export | Bash tool state 비유지로 동작 X (v1.9.0 시기 분석 결과) |

---

## 5. 검증 시나리오

본 PR 의 합격 기준:

1. **가드 코드 정합성**: subagent 프롬프트 안의 가드 bash block 이 syntax 적으로 유효 (`bash -n` 테스트 가능). awk 패턴이 `STORY_BRANCH` literal 로 동작.
2. **가드 적용 범위 명문화**: prompt 의 "적용 대상" / "적용 면제" 표가 git / 빌드 / Read-only 를 명확히 분류.
3. **STORY_BRANCH 흐름**: wrapper 사전 캡처 → prompt 치환 → subagent 가드 안 literal 사용 — 3 지점에서 단일 출처.
4. **자동 reset 명시 동의**: 옵션 (a) 가 명시 (y/N) 동의 후에만 destructive 실행. 묵시 동작 X.
5. **STATUS 매트릭스 정합성**: v1.9.0 표의 `cwd-guard-violated` 항목이 본 PR 의 가드와 일대일 대응 (자리표시 → 실제 trigger).
6. **호환성**: v1.9.0 에서 동작하던 시나리오 (`completed`, `completed-forced`, `completed-degraded`, base-stale failure) 모두 회귀 없음.

실 dispatch 회귀 (가드가 실제로 main 오염을 차단하는지 — 사고 패턴 재현) 는 다음 *외부 프로젝트* 사용 시 검증. 본 PR 은 마크다운 정합성까지.

---

## 6. 후속 PR 의존 관계

본 PR 머지 후:

- **A3 detection 가이드** PR — `verify-env-skip` 도구 패턴 가이드 강화. 본 PR 과 의존 없음.
- **A4 soft deps** PR — 위상정렬 분리. 본 PR 과 의존 없음.
- **외부 프로젝트 회귀 검증** — 다음 large feature `/sdlc:auto-epic` 실행 시 main HEAD 변동 0건 확인. 합격선: handoff 의 5건 사고 패턴 재발 X + wrapper 사후검증 알림 0회.

---

## 7. 버전 정책

본 PR 머지 시:
- `plugin.json` / `marketplace.json`: v1.9.0 → v1.10.0 (minor — 신규 가드 동작 + 자동 reset, 기존 호환 유지).
- `README.md` changelog 에 v1.10.0 항목 추가 (가드 본체 + 자동 reset).
