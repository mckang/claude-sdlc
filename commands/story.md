---
argument-hint: [start|verify|complete] [Story ID] [Plan파일 또는 feature이름, 생략 시 current]
description: Story 단위 개발 사이클 (킥오프·검증·완료) 진행
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Story 개발 사이클 (dispatcher)

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

### 단계·Story ID 검증

```bash
STEP="$1"
STORY_ID="$2"
ARG3="${3:-}"

case "$STEP" in
  start|verify|complete) ;;
  *)
    cat <<'EOF'
올바른 호출법:
/sdlc:story start <StoryID> [name|plan경로]      — Story 킥오프
/sdlc:story verify <StoryID> [name|plan경로]     — AC·DoD·테스트 검증
/sdlc:story complete <StoryID> [name|plan경로]   — Plan 업데이트 + 완료 보고
EOF
    exit 1 ;;
esac

if [ -z "$STORY_ID" ]; then
  echo "❌ Story ID 누락. 예: /sdlc:story $STEP E1-S1"
  exit 1
fi
```

### Plan 경로 resolve (공통 스크립트 재사용)

```bash
OUT_ARG=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-plan-path.sh" "$ARG3") || exit 1
NAME=$(sed -n 1p <<<"$OUT_ARG")
PLAN=$(sed -n 2p <<<"$OUT_ARG")
test -f "$PLAN" || { echo "❌ Plan 파일이 없습니다: $PLAN"; exit 1; }
```

## 2단계: Plan 읽고 Story 추출

`Read`로 Plan 파일 읽고, 해당 Story 섹션만 추출:
- Story 제목
- 담당 영역 (backend, frontend, data, qa 등)
- 크기 (S/M/L/XL)
- 설명
- 수용 기준 (AC-*)
- DoD 체크리스트
- Task 목록

Story를 찾지 못하면 중단하고 Plan에 있는 Story ID 목록 제시.

## 3단계: 단계별 dispatch

각 단계의 상세 절차는 phase 파일에 분리돼 있다. 아래 규칙으로 해당 파일을 `Read` 해서 그대로 실행한다.

| STEP | Phase 파일 |
|---|---|
| `start` | `${CLAUDE_PLUGIN_ROOT}/templates/phases/story/start.md` |
| `verify` | `${CLAUDE_PLUGIN_ROOT}/templates/phases/story/verify.md` |
| `complete` | `${CLAUDE_PLUGIN_ROOT}/templates/phases/story/complete.md` |

`$STORY_ID`, `$NAME`, `$PLAN` 은 위에서 resolve 됐다. Phase 파일 내부의 절차는 이 값을 전제로 작성돼 있다.

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
