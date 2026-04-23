# Story start — 킥오프

> **입력 가정**: dispatcher 가 `$STORY_ID`, `$NAME`, `$PLAN` 을 resolve 해 두었다.
> Plan 의 해당 Story 섹션(제목·담당 영역·크기·AC·DoD·Task) 도 이미 파싱됐다.

구현 시작 전 맥락 파악과 접근 방법 수립.

## 1. 브랜치 상태 체크 (git 저장소 전제)

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

## 2. 선행 조건 체크

- **의존성 확인**: `${CLAUDE_PROJECT_DIR}/docs/plans/plan-<name>.deps.md` 가 있으면 읽고, 이 Story의 선행 의존성이 모두 완료(`[x]`) 됐는지 확인
- 미완 의존성이 있으면 **경고**하고 계속할지 묻기:
  ```
  ⚠️ 선행 의존성 미완:
  - E1-S1 (DB 스키마) — 현재 [~] 진행중

  이 Story(E1-S3)는 E1-S1에 의존합니다. 계속 진행하시겠습니까?
  ```

## 3. 관련 문서 로드

Story의 **담당 영역**을 보고 다음을 `Read`로 읽는다:

- PRD의 관련 섹션 (기능별로 추출 어려우면 전체)
- 아키텍처의 관련 섹션 (API/DB 스키마/데이터 모델)
- 해당 스택의 표준 문서:
  - backend 영역 → `${CLAUDE_PROJECT_DIR}/docs/standards/backend/<스택>/*.md`
  - frontend 영역 → `${CLAUDE_PROJECT_DIR}/docs/standards/frontend/*.md`
  - data 영역 → `${CLAUDE_PROJECT_DIR}/docs/standards/database/*.md`
  - qa 영역 → `${CLAUDE_PROJECT_DIR}/docs/standards/<스택>/testing.md`

스택은 아키텍처 문서 또는 Plan에서 감지.

## 4. 기존 코드 탐색

`Glob`과 `Grep`으로 관련 기존 코드를 찾는다:
- 유사한 기능 패턴
- 재사용할 유틸·헬퍼
- 수정해야 할 기존 파일
- 테스트 구조

## 5. 킥오프 보고서 출력

보고서 형식은 `${CLAUDE_PLUGIN_ROOT}/templates/reports/story/kickoff.md` 에 정의돼 있다. 해당 파일을 `Read` 해서 템플릿으로 삼고, 1~4 단계에서 수집한 내용으로 `<...>` 플레이스홀더를 채워 사용자에게 출력한다.

핵심 준수 사항:
- "⚠️ 확인 필요 사항" 섹션이 있을 때는 반드시 리스트로 명시 (없으면 섹션 자체를 "없음" 한 줄로 유지).
- "다음 액션" 의 (a)/(b)/(c) 3 옵션 문구는 템플릿 그대로 유지 — 후속 흐름이 이 문구를 기대.

## 6. Story 브랜치 생성 + 킥오프 기록 (사용자 "구현 시작" 승인 직후)

사용자가 (a) 를 선택하면 **어떤 코드 작성 전에** 다음 순서를 엄수한다:

**① 기존 kickoff.md 존재 확인**

```bash
FEATURE_DIR="${CLAUDE_PROJECT_DIR}/docs/plans/$NAME/$STORY_ID"
KICKOFF_FILE="$FEATURE_DIR/kickoff.md"
OVERWRITE_KICKOFF="yes"  # 기본값

if [ -f "$KICKOFF_FILE" ]; then
  PREV_SAVED=$(awk '/^saved_at:/{print $2; exit}' "$KICKOFF_FILE")
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
