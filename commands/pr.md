---
argument-hint: [Story ID] [Plan파일|feature이름, 생략 시 current] [--draft] [--no-push]
description: Story 완료 후 git 상태 기반 PR 본문·제목·커밋 메시지 자동 생성
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Story PR 생성

사용자가 `/pr <StoryID> [Plan파일|feature이름] [--draft] [--no-push]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:pr E1-S1                                             # current feature 사용
/sdlc:pr E1-S1 checkout-v2                                 # feature 이름 → plan 경로 resolve
/sdlc:pr E1-S1 docs/plans/plan-checkout-v2.md              # 명시 경로
/sdlc:pr E1-S1 --draft                                     # current feature + Draft PR
```

## 1단계: 인자 파싱

- `$1`: Story ID
- `$2`: Plan 파일 경로 또는 feature 이름 (선택 — 생략 시 current feature)
- `--draft` (선택): Draft PR로 생성
- `--no-push`: 푸시·PR 생성 없이 **본문과 명령어만** 출력 (가장 안전)

### Plan 파일 resolve (story.md와 동일 패턴)

```bash
STORY_ID="$1"
ARG2="$2"
# 플래그는 $2 가 아닐 수 있으니 실제 파싱 시 --로 시작하면 ARG2 를 빈 값으로 처리

if [ -z "$ARG2" ] || [[ "$ARG2" == --* ]]; then
  CLAUDE_MD="${CLAUDE_PROJECT_DIR}/CLAUDE.md"
  NAME=""
  if [ -f "$CLAUDE_MD" ]; then
    NAME=$(awk '/^## Current Feature$/{flag=1; next} flag && /^- \*\*이름\*\*:/{sub(/^- \*\*이름\*\*: */, ""); print; exit}' "$CLAUDE_MD")
  fi
  if [ -z "$NAME" ]; then
    echo "❌ Plan 경로 미지정 + Current Feature 없음."
    exit 1
  fi
  PLAN="${CLAUDE_PROJECT_DIR}/docs/plans/plan-$NAME.md"
elif [ -f "$ARG2" ]; then
  PLAN="$ARG2"
else
  PLAN="${CLAUDE_PROJECT_DIR}/docs/plans/plan-$ARG2.md"
fi

test -f "$PLAN" || { echo "❌ Plan 파일이 없습니다: $PLAN"; exit 1; }
```

**기본 모드 선택**:
- 기본은 `--no-push` 처럼 동작: 실제 push·PR 생성은 하지 않고 사용자에게 명령어 제시
- `gh` CLI 설치·로그인 확인 후 사용자 **명시적 확인** 받을 때만 실제 실행

## 2단계: 환경 확인

```bash
# git repo인가
git rev-parse --is-inside-work-tree 2>/dev/null

# 현재 브랜치
git branch --show-current

# gh CLI 있나 (실제 PR 생성용)
which gh && gh auth status 2>/dev/null
```

- git repo 아님 → 중단, 이유 설명
- gh 없거나 로그인 안 됨 → 본문만 생성, 수동 생성 안내

## 3단계: Story 정보 로드

Plan 파일에서 해당 Story 섹션 읽기:
- Story 제목·설명
- AC 목록
- DoD 체크리스트
- Task 목록 및 완료 상태

## 4단계: git 변경사항 분석

```bash
# 기준 브랜치 결정 (main, master, develop 중 존재하는 것)
BASE=$(git for-each-ref --format='%(refname:short)' refs/heads/main refs/heads/master refs/heads/develop 2>/dev/null | head -1)

# 현재 브랜치와 기준 브랜치 간 diff 정보
git log $BASE..HEAD --oneline
git diff $BASE..HEAD --stat
git diff $BASE..HEAD --name-only

# 커밋 메시지들
git log $BASE..HEAD --pretty=format:"%h %s%n%b%n---"
```

결과에서 추출:
- 커밋 수·파일 수·LOC 변화
- 변경된 디렉터리별 분류 (`src/`, `tests/`, `docs/`, 마이그레이션, 설정)
- 커밋 메시지에서 Story ID 언급 확인

## 5단계: 변경 유형 자동 분류

커밋 메시지와 변경 파일로 Conventional Commits 타입 추정:
- `feat`: 새 기능 (Story의 주요 변경)
- `fix`: 버그 수정
- `refactor`: 기능 변경 없는 리팩토링
- `test`: 테스트만 추가·수정
- `docs`: 문서만
- `chore`: 의존성·빌드

대부분 Story 구현은 `feat`.

## 6단계: PR 제목·본문 생성

### 제목

```
<type>(<scope>): <Story ID> <Story 제목 한 줄>
```

예:
```
feat(auth): E1-S1 토큰 기반 인증 스키마
```

scope 추출 규칙:
- 변경된 파일 상위 디렉터리 (예: `src/main/java/.../auth/` → `auth`)
- 여러 scope면 가장 많이 변경된 것

### 본문

```markdown
## 📋 Story

**ID**: E1-S1
**제목**: 토큰 테이블 마이그레이션
**Plan**: [${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.md](${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.md)
**크기**: M

## 🎯 변경 요약

(Story 설명을 개조식 2-3줄로)

- users 테이블에 `email_verified_at` 컬럼 추가
- `email_verification_tokens` 테이블 생성 (해시 기반 저장)
- 만료·사용 추적 인덱스 포함
- 온라인 마이그레이션 검증 완료

## ✅ 수용 기준 (AC)

- [x] AC-1: users 테이블에 `email_verified_at` 컬럼 추가됨
- [x] AC-2: tokens 테이블에 FK·UNIQUE 제약 적용됨
- [x] AC-3: 스테이징에서 온라인 마이그레이션 확인됨

(Plan에서 AC 추출해서 모두 체크. Story complete 때 검증 통과한 것만 체크, 나머지는 빈 체크박스.)

## 🔍 Definition of Done

- [x] 단위 테스트 통과
- [x] 린트·타입체크 통과
- [x] 코드 리뷰 준비
- [x] 문서 업데이트 (`${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-checkout-v2.md` 4장)
- [ ] 스테이징 배포 (PR 머지 후 자동)

## 📦 변경된 파일

```
<git diff --stat 결과 요약>
5 files changed, 142 insertions(+), 18 deletions(-)

src/main/resources/db/migration/V020__... | +23
src/main/resources/db/migration/V021__... | +45
src/test/.../MigrationIntegrationTest.java | +52
${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-checkout-v2.md   | -18 +22
```

## 🧪 테스트

- 단위 테스트: 추가된 검증 (개수)
- 통합 테스트: `MigrationIntegrationTest` (Testcontainers 기반)
- 로컬 실행 결과: 전부 통과

## 🛡️ 표준 준수

관련 표준 문서:
- [${CLAUDE_PROJECT_DIR}/docs/standards/database/naming.md](${CLAUDE_PROJECT_DIR}/docs/standards/database/naming.md) — 네이밍 준수
- [${CLAUDE_PROJECT_DIR}/docs/standards/database/migrations.md](${CLAUDE_PROJECT_DIR}/docs/standards/database/migrations.md) — 온라인 마이그레이션 패턴
- [${CLAUDE_PROJECT_DIR}/docs/standards/database/schema-design.md](${CLAUDE_PROJECT_DIR}/docs/standards/database/schema-design.md) — FK/인덱스 정책

표준 예외: 없음

## 🔗 관련 링크

- PRD: [${CLAUDE_PROJECT_DIR}/docs/prd/prd-checkout-v2.md](${CLAUDE_PROJECT_DIR}/docs/prd/prd-checkout-v2.md)
- 아키텍처: [${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-checkout-v2.md](${CLAUDE_PROJECT_DIR}/docs/architecture/architecture-checkout-v2.md)
- 의존성 그래프: [${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.deps.md](${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.deps.md)

## 🚦 리뷰어 체크포인트

중점 검토 부탁드립니다:
- [ ] 마이그레이션 파일의 제약조건·인덱스 전략
- [ ] 토큰 해시 저장 방식 (원본 아닌 SHA-256)
- [ ] 롤백 가능성

## ⚠️ 배포 주의사항

- 기존 users 테이블에 컬럼 추가 → Postgres 11+ 기본값 없이 빠름
- 신규 테이블 생성은 락 영향 없음
- 롤백: `V020`, `V021` 역순 적용 SQL 포함됨 (하단 migrations/README 참조)

---

🤖 Generated with Claude Code (meeting-system v7)
Story: E1-S1 | Plan: plan-checkout-v2.md
```

## 7단계: 커밋 메시지 정리 제안 (선택)

여러 커밋을 하나로 squash할 제안:

```
현재 커밋 8개 있음. 머지 시 squash 권장?
권장 squash 메시지:

feat(auth): E1-S1 토큰 기반 인증 스키마

- V020 users.email_verified_at 컬럼 추가
- V021 email_verification_tokens 테이블 생성
- 부분 인덱스로 활성 토큰만 빠른 조회
- 온라인 마이그레이션 안전성 검증

Refs: ${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.md#E1-S1
Story-Size: M
```

## 8단계: 푸시·PR 생성 (선택, 기본 OFF)

`--no-push` 기본값이면 여기서 중단. 사용자에게:

```
📋 PR 본문 생성 완료. 다음 명령으로 PR을 직접 만들 수 있습니다:

# 1. 푸시
git push -u origin $(git branch --show-current)

# 2. PR 생성 (gh cli)
gh pr create --title "feat(auth): E1-S1 토큰 기반 인증 스키마" \
             --body-file ${CLAUDE_PROJECT_DIR}/docs/pr-drafts/E1-S1.md \
             --base main

# 또는 웹에서 직접:
https://github.com/<owner>/<repo>/compare/main...$(git branch --show-current)

본문이 저장된 곳: ${CLAUDE_PROJECT_DIR}/docs/pr-drafts/E1-S1.md
```

### `--no-push` 아닌 경우 (사용자 명시적 승인 필요)

```
⚠️ 실제로 git push 및 PR 생성을 진행할까요?

- 현재 브랜치: feature/checkout-v2-E1-S1
- 원격 push 대상: origin
- PR 대상 브랜치: main
- Draft PR: ${draft_on_off}

진행하시려면 "네, 진행" 이라고 답해주세요.
```

사용자 명시 승인 후:
```bash
git push -u origin "$(git branch --show-current)"
gh pr create --title "..." --body-file /tmp/pr-body-$STORY.md --base main $DRAFT_FLAG
```

## 9단계: 본문 파일 저장

PR 본문을 항상 저장:
```
${CLAUDE_PROJECT_DIR}/docs/pr-drafts/<Story-ID>.md
```

이유:
- 나중에 참조 가능
- `gh pr create --body-file` 에 사용
- 팀이 공용으로 수정 가능

## 10단계: 최종 보고

```
✅ PR 준비 완료

Story: E1-S1
제목: feat(auth): E1-S1 토큰 기반 인증 스키마
본문: ${CLAUDE_PROJECT_DIR}/docs/pr-drafts/E1-S1.md (저장됨)

변경 요약:
- 커밋 8개 (squash 권장)
- 파일 5개 변경, +142 -18
- AC: 3/3 충족
- DoD: 4/5 충족 (스테이징 배포는 머지 후)

다음 액션:
[사용자 수동 실행]
git push -u origin <branch>
gh pr create --body-file ${CLAUDE_PROJECT_DIR}/docs/pr-drafts/E1-S1.md --base main

또는 /pr 재실행 시 --no-push 빼면 자동 진행 (승인 필요).
```

## 주의사항

- **기본은 push 안 함** — 사용자가 PR 본문만 먼저 검토할 수 있게
- **gh CLI 없으면** URL만 제공 (웹에서 수동)
- **Force push 절대 금지**
- PR 본문에 **비밀정보·API 키 없는지** 자동 검사 (`git diff` 에서 패턴 매칭)
- 커밋 메시지에 Story ID 누락된 게 있으면 경고 표시

## 에러 처리

- git repo 아님 → 중단
- 기준 브랜치 없음 → 사용자에게 main/master/develop 물어보기
- 커밋이 기준 브랜치와 같음 (변경 없음) → "변경 없음" 알림 후 중단
- 현재 브랜치가 기준 브랜치 → "브랜치를 먼저 만드세요" 안내

## 팁

- Story complete 직후 바로 실행하는 흐름 권장:
  ```
  /story complete E1-S1 ${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.md
  /pr E1-S1 ${CLAUDE_PROJECT_DIR}/docs/plans/plan-checkout-v2.md
  ```
- 팀마다 브랜치·PR 관례 다를 수 있음 → `${CLAUDE_PROJECT_DIR}/docs/guides/development-workflow.md` 에 팀 규칙 명시 권장
