---
description: 현재 프로젝트에 SDLC 작업 디렉토리 구조와 표준 문서를 설치한다
argument-hint: (인자 없음)
allowed-tools: Read, Write, Edit, Bash, Glob
---

# SDLC 프로젝트 초기화

현재 사용자 프로젝트(`${CLAUDE_PROJECT_DIR}`)에 SDLC 플러그인이 동작하는 데 필요한 디렉토리 구조, 표준 문서, 샘플 템플릿을 설치한다.

## 1단계: 작업 디렉토리 생성

다음 명령으로 `docs/` 트리를 생성한다 (이미 있는 디렉토리는 건너뜀).

```bash
mkdir -p "${CLAUDE_PROJECT_DIR}/docs"/{prd,architecture,plans,plans/archive,plans/scope-changes,meetings,retrospectives,standups,pr-drafts,onboarding,guides,standards}
```

## 2단계: 표준 문서 설치

`${CLAUDE_PLUGIN_ROOT}/templates/docs/standards/` 의 모든 파일을 `${CLAUDE_PROJECT_DIR}/docs/standards/` 로 복사한다. **기존 파일은 덮어쓰지 않는다** (사용자가 수정했을 수 있음).

```bash
cp -Rn "${CLAUDE_PLUGIN_ROOT}/templates/docs/standards/." "${CLAUDE_PROJECT_DIR}/docs/standards/"
```

## 3단계: 가이드 문서 설치

```bash
cp -Rn "${CLAUDE_PLUGIN_ROOT}/templates/docs/guides/." "${CLAUDE_PROJECT_DIR}/docs/guides/"
```

## 4단계: 샘플 PRD/아키텍처 설치 (선택)

샘플이 이미 있는지 확인하고 없으면 설치:

```bash
if [ ! -f "${CLAUDE_PROJECT_DIR}/docs/prd/email-verification.md" ]; then
  cp "${CLAUDE_PLUGIN_ROOT}/templates/docs/prd/email-verification.md" "${CLAUDE_PROJECT_DIR}/docs/prd/"
fi
if [ ! -f "${CLAUDE_PROJECT_DIR}/docs/architecture/email-verification.md" ]; then
  cp "${CLAUDE_PLUGIN_ROOT}/templates/docs/architecture/email-verification.md" "${CLAUDE_PROJECT_DIR}/docs/architecture/"
fi
```

## 5단계: CLAUDE.md 처리

`${CLAUDE_PROJECT_DIR}/CLAUDE.md` 가 **없으면** 템플릿을 복사한다. **있으면** 덮어쓰지 않고 아래와 같은 안내를 출력한다:

```
⚠️  기존 CLAUDE.md가 발견되었습니다.
다음 규칙을 수동으로 병합하시려면 아래 파일을 참고하세요:
   ${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md

핵심 규칙: Story 단위 작업, 구현 중 금지, 결정 지점, Plan 갱신, 스코프 변경, 테스트·보안.
```

```bash
if [ ! -f "${CLAUDE_PROJECT_DIR}/CLAUDE.md" ]; then
  cp "${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md" "${CLAUDE_PROJECT_DIR}/CLAUDE.md"
  echo "✓ CLAUDE.md 생성 완료"
else
  echo "⚠️  기존 CLAUDE.md 유지 — ${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md 참고해서 수동 병합 권장"
fi
```

## 6단계: .gitignore 업데이트

`.gitignore` 에 다음 항목이 없으면 추가:

```
docs/standups/
docs/pr-drafts/
docs/onboarding/
docs/plans/archive/
```

```bash
GITIGNORE="${CLAUDE_PROJECT_DIR}/.gitignore"
touch "$GITIGNORE"
for entry in "docs/standups/" "docs/pr-drafts/" "docs/onboarding/" "docs/plans/archive/"; do
  grep -qxF "$entry" "$GITIGNORE" || echo "$entry" >> "$GITIGNORE"
done
```

## 7단계: 완료 안내

다음 형식으로 요약을 출력:

```markdown
# ✓ SDLC 플러그인 초기화 완료

## 설치된 것
- `docs/` 트리 (prd, architecture, plans, meetings, ...)
- `docs/standards/` 25개 표준 문서 (backend/frontend/database)
- `docs/guides/development-workflow.md`
- 샘플 PRD: `docs/prd/email-verification.md`
- 샘플 아키텍처: `docs/architecture/email-verification.md`
- CLAUDE.md (기존 없을 때만)

## 다음 단계

1. **PRD 작성**: `docs/prd/<feature>.md` 에 요구사항 작성
2. **아키텍처 설계**: `docs/architecture/<feature>.md` 에 설계 작성
   - 또는 `/sdlc:meeting architect, backend, dba | <주제>` 로 토론
3. **Plan 생성**: `/sdlc:plan docs/prd/<feature>.md docs/architecture/<feature>.md docs/plans/<feature>.md`
4. **Story 시작**: `/sdlc:story start E1-S1 docs/plans/<feature>.md`

## 사용 가능한 커맨드
- `/sdlc:roles` — 21명 페르소나 목록
- `/sdlc:plan` — Epic→Story→Task 분해
- `/sdlc:story` — Story 개발 사이클
- `/sdlc:meeting` — 팀 토론
- `/sdlc:standup` — 일일 스탠드업
- `/sdlc:status` — 진행 상황 집계
- `/sdlc:pr` — PR 본문 생성
- `/sdlc:scope-change` — 스코프 변경 기록
- `/sdlc:plan-review` — Plan 리뷰
- `/sdlc:retrospective` — 회고
- `/sdlc:onboard` — 새 팀원 온보딩
```

## 에러 처리

- `${CLAUDE_PROJECT_DIR}` 가 설정돼 있지 않으면: "이 커맨드는 플러그인 환경에서만 동작합니다. Claude Code 로 프로젝트를 열어주세요." 출력 후 종료.
- `${CLAUDE_PLUGIN_ROOT}/templates/` 가 없으면: "플러그인 설치가 손상되었습니다. 재설치 후 시도하세요." 출력.
- 각 복사 명령 실패 시 어떤 파일이 실패했는지 명시.
