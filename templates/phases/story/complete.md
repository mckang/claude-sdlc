# Story complete — 완료 처리

> **입력 가정**: dispatcher 가 `$STORY_ID`, `$NAME`, `$PLAN` 을 resolve 해 두었다.

모든 검증 통과 후 Plan 업데이트·커밋 준비.

## 1. 최종 검증 재실행

`verify` 의 요약을 다시 한번 돌려 최종 상태 확인. 미해결 있으면:

```
⚠️ 미해결 DoD 항목이 있습니다:
- 통합 테스트 1건 실패

정말 완료 처리하시겠습니까?
- (a) 먼저 수정한 후 다시 complete
- (b) 강제 완료 (Plan의 DoD에 실패 사유 기록)
```

## 2. Plan 갱신

Plan 파일에서 해당 Story의:
- Story 헤더 상태 마크 추가 (있으면): `#### E1-S1: ... <!-- 상태: done -->`
- Task 체크박스를 `- [x]` 로 변경

`Edit` 로 각 Task 줄을 업데이트.

## 3. 스냅샷 갱신

내부적으로 `/status --update` 동등 동작 수행:
- Plan 상단의 "📊 최근 상태 스냅샷" 섹션 갱신

## 4. 완료 보고

보고서 형식은 `${CLAUDE_PLUGIN_ROOT}/templates/reports/story/complete.md` 에 정의돼 있다. `Read` 해서 템플릿으로 쓰고, 1~3 결과와 구현 중 수집한 변경 내역·커밋 후보 메시지로 채워 사용자에게 출력한다.

핵심 준수 사항:
- **커밋 제안** 섹션의 `Refs: <Plan 경로>#<STORY_ID>` 라인은 템플릿 그대로 유지 (자동 crossref 추적에 사용).
- **다음 Story 제안** 은 `plan-<name>.deps.md` 를 `Read` 해서 이 Story 완료로 unblock 되는 후보만 나열.

## 5. complete.md 저장 (덮어쓰기 확인)

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

## 6. 커밋 · 머지 · 브랜치 정리 (완료 보고 직후)

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
