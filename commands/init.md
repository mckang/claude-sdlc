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

## 5단계: CLAUDE.md 처리 (대화식)

### 5-a. 프로젝트 오너 이름 수집

사용자에게 다음을 **먼저 출력한 뒤 응답을 기다려라**:

```
이 프로젝트의 오너(최종 의사결정자) 이름을 알려주세요.
미팅·토론 중 결정이 필요할 때 Claude 가 이 사람에게 질의합니다.
(엔터만 치면 스킵)
```

사용자 응답 문자열을 `OWNER_NAME` 변수로 보관한다. 응답이 빈 문자열이면 이후의 오너 섹션 처리는 모두 생략한다.

### 5-b. CLAUDE.md 처리 분기

`DEST` 가 존재하지 않으면 템플릿을 복사한 뒤 오너 섹션을 치환/제거.
`DEST` 가 이미 존재하면 파일을 보존한 채 오너 섹션만 조건부 append.

```bash
DEST="${CLAUDE_PROJECT_DIR}/CLAUDE.md"
TPL="${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md"

if [ ! -f "$DEST" ]; then
  cp "$TPL" "$DEST"
  if [ -n "$OWNER_NAME" ]; then
    # sed 구분자를 | 로 써서 이름에 / 가 있어도 안전. & | \ 는 이스케이프.
    ESCAPED=$(printf '%s' "$OWNER_NAME" | sed 's/[&|\\]/\\&/g')
    sed -i.bak "s|{NAME}|$ESCAPED|" "$DEST" && rm "$DEST.bak"
    echo "✓ CLAUDE.md 생성 완료 (오너: $OWNER_NAME)"
  else
    # 오너 섹션 블록 전체 제거.
    # 주의: 템플릿에는 이미 다른 위치(빠른 명령 참조 블록 앞)에 '---' 구분선이 있다.
    # 단순 '/^---$/,$d' 는 그 구분선부터 삭제해 빠른 명령 참조까지 날려버린다.
    # '## 프로젝트 오너' 헤더를 앵커로 삼아 그 앞의 '---' 와 빈 줄까지만 제거.
    perl -i -0777 -pe 's/\n+---\n+## 프로젝트 오너\n.*\z/\n/s' "$DEST"
    echo "✓ CLAUDE.md 생성 완료 (오너 섹션 스킵)"
  fi
else
  if [ -z "$OWNER_NAME" ]; then
    echo "⚠️  기존 CLAUDE.md 유지 — ${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md 참고해서 수동 병합 권장"
  elif grep -q '^## 프로젝트 오너$' "$DEST"; then
    echo "⚠️  기존 CLAUDE.md 에 이미 '## 프로젝트 오너' 섹션이 있습니다. 수동 확인 권장."
  else
    {
      printf '\n---\n\n## 프로젝트 오너\n'
      printf -- '- **이름**: %s\n' "$OWNER_NAME"
      printf -- '- **역할**: 최종 의사결정자. 미팅·토론 중 결정이 필요하면 반드시 이 사용자에게 질의.\n'
    } >> "$DEST"
    echo "✓ 기존 CLAUDE.md 에 프로젝트 오너 섹션 append 완료 (오너: $OWNER_NAME)"
  fi
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
