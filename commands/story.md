---
argument-hint: [start|verify|complete] [Story ID] [Plan파일 또는 feature이름, 생략 시 current]
description: Story 단위 개발 사이클 (킥오프·검증·완료) 진행
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Story 개발 사이클 명령

> **입력 전제**: `/sdlc:plan` 산출물(`docs/plans/plan-<name>.md`)을 사용한다.
> `start` 단계는 해당 feature 의 `docs/prd/prd-<name>.md` 와 `docs/architecture/architecture-<name>.md` 를
> 참조로 자동 로드하여 구현 맥락을 수립한다 (존재할 경우).

사용자가 `/story <단계> <StoryID> [Plan파일|feature이름]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:story start E1-S1                      # current feature 사용
/sdlc:story start E1-S1 checkout-v2          # feature 이름 → plan 경로 resolve
/sdlc:story start E1-S1 docs/plans/plan-checkout-v2.md   # 명시 경로
```

## 1단계: 인자 파싱

- `$1`: 단계 (`start` | `verify` | `complete`)
- `$2`: Story ID (예: `E1-S1`)
- `$3`: Plan 파일 경로 또는 feature 이름 (선택 — 생략 시 current feature)

### Plan 파일 경로 확정

```bash
STEP="$1"
STORY_ID="$2"
ARG3="$3"

if [ -z "$ARG3" ]; then
  # Current Feature 로부터 이름 resolve
  NAME=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-current-feature.sh")
  if [ -z "$NAME" ]; then
    echo "❌ Plan 경로 미지정 + Current Feature 없음. /sdlc:feature <이름> 먼저 실행하세요."
    exit 1
  fi
  PLAN="${CLAUDE_PROJECT_DIR}/docs/plans/plan-$NAME.md"
  echo "ℹ️  Current Feature 사용: $NAME"
elif [ -f "$ARG3" ]; then
  # 존재하는 파일 경로
  PLAN="$ARG3"
  NAME=$(basename "$PLAN" .md | sed 's/^plan-//')
else
  # kebab-case 이름으로 해석
  NAME="$ARG3"
  PLAN="${CLAUDE_PROJECT_DIR}/docs/plans/plan-$NAME.md"
fi

test -f "$PLAN" || { echo "❌ Plan 파일이 없습니다: $PLAN"; exit 1; }
```

단계가 잘못됐으면 안내하고 중단:
```
올바른 호출법:
/sdlc:story start <StoryID> [name|plan경로]      — Story 킥오프
/sdlc:story verify <StoryID> [name|plan경로]     — AC·DoD·테스트 검증
/sdlc:story complete <StoryID> [name|plan경로]   — Plan 업데이트 + 완료 보고
```

## 2단계: Plan 읽고 Story 추출

`Read`로 Plan 파일 읽고, 해당 Story 섹션만 추출:
- Story 제목
- 담당 영역 (backend, frontend, dba, qa 등)
- 크기 (S/M/L/XL)
- 설명
- 수용 기준 (AC-*)
- DoD 체크리스트
- Task 목록

Story를 찾지 못하면 중단하고 Plan에 있는 Story ID 목록 제시.

## 3단계: 단계별 동작

---

### 3-A: `start` 단계 — Story 킥오프

구현 시작 전 맥락 파악과 접근 방법 수립.

#### 3-A-0: 브랜치 상태 체크 (git 저장소 전제)

**워킹 트리가 깨끗한 상태에서 새 Story 를 시작**한다. `Bash`로 확인:

```bash
git status --short   # 출력이 비어있어야 함
git branch --show-current
```

분기 처리:
- **워킹 트리에 uncommitted 변경 있음** → 중단하고 사용자에게 안내:
  ```
  ⚠️ 워킹 트리에 커밋되지 않은 변경이 있습니다.
  다음 중 선택:
  - (a) 먼저 커밋/스태시 후 다시 `/story start` 호출
  - (b) 이 변경이 이전 Story 의 일부면 해당 Story 를 먼저 `/story complete`
  ```
- **현재 브랜치가 `main`/`master` 가 아님** → 직전 Story 브랜치일 가능성:
  ```
  ⚠️ 현재 브랜치: story/E1-S1-...
  Story 는 main 기준으로 분기합니다. 다음 중 선택:
  - (a) 직전 Story 를 `/story complete` 로 먼저 마무리
  - (b) 의도적 분기 (예: 스파이크) 면 확인 후 계속
  ```
- **git 저장소가 아님** → `git init` 먼저 하도록 안내하고 중단

#### 3-A-1: 선행 조건 체크

- **의존성 확인**: `${CLAUDE_PROJECT_DIR}/docs/plans/plan-<name>.deps.md` 가 있으면 읽고, 이 Story의 선행 의존성이 모두 완료(`[x]`) 됐는지 확인
- 미완 의존성이 있으면 **경고**하고 계속할지 묻기:
  ```
  ⚠️ 선행 의존성 미완:
  - E1-S1 (DB 스키마) — 현재 [~] 진행중
  
  이 Story(E1-S3)는 E1-S1에 의존합니다. 계속 진행하시겠습니까?
  ```

#### 3-A-2: 관련 문서 로드

Story의 **담당 영역**을 보고 다음을 `Read`로 읽는다:

- PRD의 관련 섹션 (기능별로 추출 어려우면 전체)
- 아키텍처의 관련 섹션 (API/DB 스키마/데이터 모델)
- 해당 스택의 표준 문서:
  - backend 영역 → `${CLAUDE_PROJECT_DIR}/docs/standards/backend/<스택>/*.md`
  - frontend 영역 → `${CLAUDE_PROJECT_DIR}/docs/standards/frontend/*.md`
  - dba 영역 → `${CLAUDE_PROJECT_DIR}/docs/standards/database/*.md`
  - qa 영역 → `${CLAUDE_PROJECT_DIR}/docs/standards/<스택>/testing.md`

스택은 아키텍처 문서 또는 Plan에서 감지.

#### 3-A-3: 기존 코드 탐색

`Glob`과 `Grep`으로 관련 기존 코드를 찾는다:
- 유사한 기능 패턴
- 재사용할 유틸·헬퍼
- 수정해야 할 기존 파일
- 테스트 구조

#### 3-A-4: 킥오프 보고서 출력

보고서 형식은 `${CLAUDE_PLUGIN_ROOT}/templates/reports/story/kickoff.md` 에 정의돼 있다. 해당 파일을 `Read` 해서 템플릿으로 삼고, `<...>` 플레이스홀더를 3-A-1 ~ 3-A-3 에서 수집한 내용으로 채워 사용자에게 출력한다.

핵심 준수 사항:
- "⚠️ 확인 필요 사항" 섹션이 있을 때는 반드시 리스트로 명시 (없으면 섹션 자체를 "없음" 한 줄로 유지).
- "다음 액션" 의 (a)/(b)/(c) 3 옵션 문구는 템플릿 그대로 유지 — 후속 흐름이 이 문구를 기대.

#### 3-A-5: Story 브랜치 생성 + 킥오프 기록 (사용자 "구현 시작" 승인 직후)

사용자가 (a) 를 선택하면 **어떤 코드 작성 전에** 다음 순서를 엄수한다:

**① 기존 kickoff.md 존재 확인**

```bash
FEATURE_DIR="${CLAUDE_PROJECT_DIR}/docs/plans/$NAME/$STORY_ID"
KICKOFF_FILE="$FEATURE_DIR/kickoff.md"
OVERWRITE_KICKOFF="yes"  # 기본값

if [ -f "$KICKOFF_FILE" ]; then
  PREV_SAVED=$(awk '/^saved_at:/{print $2; exit}' "$KICKOFF_FILE")
  # 사용자에게 확인 요청 (아래 프롬프트 출력 후 응답 대기)
  OVERWRITE_KICKOFF=""  # y/N 응답으로 설정
fi
```

`$KICKOFF_FILE` 이 존재하면 Bash 실행을 일시 중단하고 사용자에게 아래 프롬프트를 출력한 뒤 응답을 받아 `OVERWRITE_KICKOFF` 을 채운 후 다음 블록을 실행한다.

```
⚠️ kickoff.md 가 이미 있습니다 (saved_at: <PREV_SAVED>).
덮어쓸까요? (y/N)
```
- `y` → `OVERWRITE_KICKOFF=yes`
- 그 외(엔터 포함) → `OVERWRITE_KICKOFF=no` (기존 파일 보존)

**② Story 브랜치 생성**

```bash
# main 을 최신으로 맞추고 (원격 있을 때만 pull)
git checkout main
git pull --ff-only origin main 2>/dev/null || true

# Story 브랜치 생성
git checkout -b story/<StoryID>-<slug>
```

브랜치 네이밍: `story/<StoryID>-<kebab-slug>`
- `<StoryID>` 는 Plan 그대로 (`E1-S2`, `E5-S2a`)
- `<slug>` 는 Story 제목을 kebab-case 로 축약 (영문·숫자·하이픈만, 4단어 이하)
- 예:
  - `story/E1-S2-make-ci-gate`
  - `story/E5-S2a-next-in-progress`
  - `story/E6-S1-outbox-repo`

실패 시 (원격 pull 실패 등) 경고만 남기고 로컬 main 기준으로 계속.

**③ kickoff.md 저장 (OVERWRITE_KICKOFF=yes 일 때만)**

브랜치 생성 **직후** 저장해야 프런트매터 `branch` 가 실제 브랜치와 일치.

```bash
mkdir -p "$FEATURE_DIR"

SAVED_AT=$(date +%Y-%m-%dT%H:%M:%S%z)
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "(unknown)")

# PLAN_REL 은 ${CLAUDE_PROJECT_DIR} 기준 상대경로
PLAN_REL="${PLAN#${CLAUDE_PROJECT_DIR}/}"
```

`Write` 로 `$KICKOFF_FILE` 생성:

```markdown
---
story_id: <STORY_ID>
story_title: <Story 제목>
feature: <NAME>
plan: <PLAN_REL>
stage: kickoff
saved_at: <SAVED_AT>
branch: <BRANCH_NAME>
---
<사용자에게 출력한 킥오프 보고서 Markdown 본문 그대로>
```

`Write` 실패 시 경고 1줄 후 계속 진행 (저장은 보조 기능).

**④ 최종 1줄 보고**

- 저장 성공:
  ```
  🌿 브랜치 `story/<StoryID>-<slug>` 생성. 📝 kickoff.md 기록 (docs/plans/<NAME>/<STORY_ID>/kickoff.md). 구현 시작합니다.
  ```
- 저장 skip(덮어쓰기 거부):
  ```
  🌿 브랜치 `story/<StoryID>-<slug>` 생성. 📝 kickoff.md 보존 (기존 파일 유지). 구현 시작합니다.
  ```
- 저장 실패:
  ```
  🌿 브랜치 `story/<StoryID>-<slug>` 생성. ⚠️ kickoff.md 저장 실패 (<사유>). 구현 시작합니다.
  ```

---

### 3-B: `verify` 단계 — 검증

구현이 어느 정도 끝난 뒤 호출. AC·DoD·테스트를 체계적으로 점검.

#### 3-B-0: 브랜치 컨텍스트 확인

```bash
git branch --show-current
```

- **현재 브랜치가 `story/<StoryID>-...` 패턴이 아님** → 경고 1줄 남기고 계속 진행 (초창기 Story 또는 예외 케이스 가능):
  ```
  ⚠️ 현재 브랜치 `main` — Story 브랜치 규칙 위반 가능. verify 는 계속 진행하되 complete 단계에서 브랜치 전략 확인 필요.
  ```
- **다른 Story 의 브랜치에 있음** (`story/E1-S2-...` 인데 `/story verify E1-S1` 호출) → 중단하고 ID 불일치 알림

#### 3-B-1: 테스트 실행

`Bash`로 해당 Story의 테스트를 실행. 프로젝트 스택에 따라:

- Spring Boot: `./gradlew test --tests "*<키워드>*"`
- Next.js: `pnpm test <패턴>`
- FastAPI: `pytest tests/<경로>`

테스트 실패 시 결과 분석해서 원인 분류:
- 구현 버그
- 테스트 자체 오류
- AC 해석 차이

#### 3-B-2: AC 검증

각 AC를 하나씩 점검:

```markdown
## AC 검증

### AC-1: 정상 로그인 플로우
- Given 등록된 이메일/비밀번호 → When 로그인 → Then 세션 발급
- ✅ 테스트 `AuthServiceTest#shouldIssueSessionOnValidCredentials` 통과
- 확인됨

### AC-2: 잘못된 비밀번호
- ...
- ❌ 테스트 없음 — 작성 필요

### AC-3: Rate limit
- ...
- 🟡 테스트는 있으나 실제 Redis 환경에서 미검증
```

#### 3-B-3: DoD 점검

Story의 DoD 체크리스트를 순회:

```markdown
## DoD 점검

- [x] 단위 테스트 통과 — 12/12
- [x] 린트 통과 (`./gradlew check`)
- [ ] 통합 테스트 통과 — 1 실패 (Testcontainers 시작 실패)
- [x] 코드 리뷰 준비 완료
- [ ] 스테이징 배포 — 아직
- [x] 문서 업데이트 (README, API docs)
- [ ] 성능 기준 충족 — 측정 안 함 (NFR 인증 p95 500ms)
```

#### 3-B-4: 표준 체크리스트 (자동)

관련 표준의 "금지 사항" 섹션을 기준으로 코드 점검:

- `security.md`:
  - 비밀번호 평문 저장? 로그 노출?
  - SQL 인젝션 방어?
  - 민감정보 URL 노출?
- `api.md`:
  - HTTP 상태 코드 규칙?
  - 에러 응답 포맷(ProblemDetail)?
  - `@Valid` 누락?
- `testing.md`:
  - `Thread.sleep()` 있나?
  - H2 사용 (금지)?

Grep으로 탐지 후 보고.

#### 3-B-5: 검증 요약 보고

보고서 형식은 `${CLAUDE_PLUGIN_ROOT}/templates/reports/story/verify.md` 에 정의돼 있다. `Read` 해서 템플릿으로 쓰고, 3-B-1 ~ 3-B-4 결과로 채워 사용자에게 출력한다.

판정 고정 규칙:
- ✅ PASS: 모든 AC 확인 + DoD 완전 충족 + 표준 위반 0 건.
- 🟡 CONDITIONAL PASS: 핵심 AC 는 통과했지만 일부 DoD 미완 또는 경미한 표준 경고.
- ❌ FAIL: AC 중 하나 이상 불통 또는 표준 위반 🔴 심각.

다음 하위 단계(3-B-6) 의 `verify.md` 저장 시 이 판정 라인을 프런트매터 아래 본문 최상단에 유지한다 — 후속 `complete` 단계가 이를 읽어 강제 진행 여부를 판단한다.

#### 3-B-6: verify.md 저장 (조용한 덮어쓰기)

보고서 출력 직후 `${CLAUDE_PROJECT_DIR}/docs/plans/$NAME/$STORY_ID/verify.md` 로 저장한다. 확인 프롬프트 없음 — verify 는 재실행이 정상 워크플로.

```bash
FEATURE_DIR="${CLAUDE_PROJECT_DIR}/docs/plans/$NAME/$STORY_ID"
mkdir -p "$FEATURE_DIR"

SAVED_AT=$(date +%Y-%m-%dT%H:%M:%S%z)
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "(unknown)")
PLAN_REL="${PLAN#${CLAUDE_PROJECT_DIR}/}"
```

`Write` 로 `$FEATURE_DIR/verify.md` 생성 (기존 파일 덮어쓰기):

```markdown
---
story_id: <STORY_ID>
story_title: <Story 제목>
feature: <NAME>
plan: <PLAN_REL>
stage: verify
saved_at: <SAVED_AT>
branch: <BRANCH_NAME>
---
<사용자에게 출력한 검증 요약 보고서 Markdown 본문 그대로>
```

보고서 말미에 1줄 추가:
```
📝 verify.md 갱신됨 (docs/plans/<NAME>/<STORY_ID>/verify.md)
```

`Write` 실패 시 경고 1줄 후 계속.

---

### 3-C: `complete` 단계 — 완료 처리

모든 검증 통과 후 Plan 업데이트·커밋 준비.

#### 3-C-1: 최종 검증 재실행

`verify` 의 요약을 다시 한번 돌려 최종 상태 확인. 미해결 있으면:

```
⚠️ 미해결 DoD 항목이 있습니다:
- 통합 테스트 1건 실패

정말 완료 처리하시겠습니까?
- (a) 먼저 수정한 후 다시 complete
- (b) 강제 완료 (Plan의 DoD에 실패 사유 기록)
```

#### 3-C-2: Plan 갱신

Plan 파일에서 해당 Story의:
- Story 헤더 상태 마크 추가 (있으면): `#### E1-S1: ... <!-- 상태: done -->`
- Task 체크박스를 `- [x]` 로 변경

`str_replace` 로 각 Task 줄을 업데이트.

#### 3-C-3: 스냅샷 갱신

내부적으로 `/status --update` 동등 동작 수행:
- Plan 상단의 "📊 최근 상태 스냅샷" 섹션 갱신

#### 3-C-4: 완료 보고

보고서 형식은 `${CLAUDE_PLUGIN_ROOT}/templates/reports/story/complete.md` 에 정의돼 있다. `Read` 해서 템플릿으로 쓰고, 3-C-1 ~ 3-C-3 결과와 구현 중 수집한 변경 내역·커밋 후보 메시지로 채워 사용자에게 출력한다.

핵심 준수 사항:
- **커밋 제안** 섹션의 `Refs: <Plan 경로>#<STORY_ID>` 라인은 템플릿 그대로 유지 (자동 crossref 추적에 사용).
- **다음 Story 제안** 은 `plan-<name>.deps.md` 를 `Read` 해서 이 Story 완료로 unblock 되는 후보만 나열.

#### 3-C-5: complete.md 저장 (덮어쓰기 확인)

완료 보고 출력 직후, 커밋·머지 전에 기록한다.

```bash
FEATURE_DIR="${CLAUDE_PROJECT_DIR}/docs/plans/$NAME/$STORY_ID"
COMPLETE_FILE="$FEATURE_DIR/complete.md"
OVERWRITE_COMPLETE="yes"

if [ -f "$COMPLETE_FILE" ]; then
  PREV_SAVED=$(awk '/^saved_at:/{print $2; exit}' "$COMPLETE_FILE")
  OVERWRITE_COMPLETE=""  # y/N 응답으로 설정
fi
```

`$COMPLETE_FILE` 이 존재하면 Bash 실행을 일시 중단하고 사용자에게 아래 프롬프트를 출력한 뒤 응답을 받아 `OVERWRITE_COMPLETE` 를 채운 후 다음 블록을 실행한다.

```
⚠️ complete.md 가 이미 있습니다 (saved_at: <PREV_SAVED>).
이 Story 는 이미 한 번 완료 처리됐을 수 있습니다. 덮어쓸까요? (y/N)
```
- `y` → `OVERWRITE_COMPLETE=yes`
- 그 외(엔터 포함) → `OVERWRITE_COMPLETE=no` (기존 파일 보존)

`OVERWRITE_COMPLETE=yes` 일 때만:

```bash
mkdir -p "$FEATURE_DIR"
SAVED_AT=$(date +%Y-%m-%dT%H:%M:%S%z)
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "(unknown)")
PLAN_REL="${PLAN#${CLAUDE_PROJECT_DIR}/}"
```

`Write` 로 `$COMPLETE_FILE` 생성 (덮어쓰기):

```markdown
---
story_id: <STORY_ID>
story_title: <Story 제목>
feature: <NAME>
plan: <PLAN_REL>
stage: complete
saved_at: <SAVED_AT>
branch: <BRANCH_NAME>
---
<사용자에게 출력한 완료 보고서 Markdown 본문 그대로>
```

저장 결과 1줄:
- 성공: `📝 complete.md 기록됨 (docs/plans/<NAME>/<STORY_ID>/complete.md)`
- skip: `📝 complete.md 보존 (기존 파일 유지)`
- 실패: `⚠️ complete.md 저장 실패 (<사유>)`

`Write` 실패 시 경고 1줄 후 아래 커밋·머지 흐름은 정상 진행 (저장은 보조 기능).

#### 3-C-6: 커밋 · 머지 · 브랜치 정리 (완료 보고 직후)

Story 브랜치에서 작업했을 때만 수행. 아니면 이 단계 skip 하고 사용자에게 한 줄 경고:
`⚠️ Story 브랜치 규칙을 따르지 않음 — 수동 정리 필요`

**Step 1. 남은 변경 커밋**
완료 보고에 제시한 커밋 메시지(들)로 현재 브랜치에 커밋. 여러 논리 단위면 분할 커밋 권장.

**Step 2. 통합 방식 선택 (사용자 확인)**

```
Story `story/E1-S2-make-ci-gate` 작업 완료. 통합 방식을 선택하세요:

- (a) 로컬 머지 — `git checkout main && git merge --no-ff <브랜치>` 후 브랜치 삭제
- (b) PR 생성 — `/pr E1-S2 <Plan경로>` 호출, 리뷰 후 원격에서 머지
- (c) 보류 — 브랜치 유지, 수동 정리 예정
```

선택된 경로별 동작:

- **(a) 로컬 머지**:
  ```bash
  git checkout main
  git merge --no-ff story/E1-S2-make-ci-gate -m "Merge Story E1-S2: make ci 게이트"
  git branch -d story/E1-S2-make-ci-gate
  ```
  push 는 **사용자 명시 요청 시에만** 수행 (기본 skip).
  머지 충돌 시 중단하고 사용자에게 해결 요청 (`--abort` 금지, 수동 처리).

- **(b) PR 생성**: `/pr` 커맨드 흐름으로 위임. 이 단계에서는 현재 브랜치를 `git push -u origin <브랜치>` 로 원격에 먼저 올릴지 사용자에게 확인.

- **(c) 보류**: 브랜치·커밋만 유지, 아무 변경 없음.

**Step 3. 후처리 보고** (머지 완료 시 1줄):
```
🔀 머지 완료: main ← story/E1-S2-make-ci-gate (브랜치 삭제됨). 다음 Story 는 main 기준으로 시작.
```

## 4단계: 공통 규칙

- **사용자 확인 기다리기**: `start` 끝에서 "구현 시작" 답변 오기 전까진 코드 작성 안 함. `verify`·`complete`도 중대 변경 시 확인 요청.
- **모든 출력에 Story ID 포함**: 여러 Story 진행 중이어도 혼선 없게.
- **표준 위반 감지 시 예외 기록**: 코드에 주석 + Plan 또는 meeting 파일 링크.
- **세션 간 재현 가능**: `start` 실행만으로 필요한 맥락이 다 로드되도록 설계.
- **블로킹 감지 시 대안 제시**: 다른 Story로 병렬 작업 제안.
- **브랜치 전략 (필수)**: 모든 Story 는 `main` 에서 분기한 `story/<StoryID>-<kebab-slug>` 브랜치에서 작업하고, `complete` 시 main 에 머지한 뒤 브랜치를 삭제한다. `main` 에서 직접 커밋 금지. 예외(주석·문서 오타 수정 등)는 사용자 명시 요청 시에만 허용.
- **단계별 보고서 저장 (필수)**: `start`(승인 후)·`verify`·`complete` 각 단계는 `${CLAUDE_PROJECT_DIR}/docs/plans/<feature>/<Story-ID>/{kickoff,verify,complete}.md` 로 저장된다. `start`·`complete` 는 기존 파일이 있으면 덮어쓰기 확인, `verify` 는 조용히 덮어쓰기. 저장 실패는 핵심 워크플로를 막지 않는다.

## 5단계: 에러 처리

- Plan 파일 없음 → 중단, `/plan` 먼저 실행 안내
- Story ID 못 찾음 → Plan의 Story 목록 보여주고 선택 요청
- 표준 문서 없음 → 경고만 내고 일반 원칙으로 진행
- 테스트 도구 감지 실패 → 사용자에게 실행 명령 물어보기
