# /sdlc:release 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PR 머지 이후 운영 배포까지의 공백을 메우는 `/sdlc:release` 커맨드를 구현한다.

**Architecture:** Phase-Gate 모델 — Pre-release 검증 → T'Challa/Thor Go/No-go 게이트 → 배포 명령 안내 및 롤백 문서화. 단일 마크다운 커맨드 파일로 구현하며, 기존 `resolve-plan-path.sh` 스크립트를 재사용한다.

**Tech Stack:** Markdown procedure file, Bash (인자 파싱·파일 읽기), 기존 `scripts/resolve-plan-path.sh`

**Spec:** `docs/specs/2026-04-23-release-command-design.md`

---

## 변경 파일 목록

| 작업 | 파일 | 내용 |
|------|------|------|
| Create | `commands/release.md` | 릴리스 커맨드 전체 |
| Modify | `commands/init.md` | `docs/releases/` 디렉터리 생성 추가 |

---

## Task 1: 커맨드 파일 기반 구조 생성

**Files:**
- Create: `commands/release.md`

- [ ] **Step 1: 파일 생성 — frontmatter + 인트로 + 인자 파싱 섹션**

`commands/release.md` 를 아래 내용으로 생성한다:

```markdown
---
argument-hint: [Story ID | feature이름, 생략 시 current] [--story | --feature] [--dry-run]
description: Phase-Gate 릴리스 체크리스트 — Pre-release 검증 → Go/No-go 게이트 → 배포 안내 및 롤백 문서화
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 릴리스 (Release)

사용자가 `/release [Story ID | feature이름] [--story | --feature] [--dry-run]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:release                          # current feature 릴리스
/sdlc:release checkout-v2              # feature 이름 지정
/sdlc:release E1-S1 --story           # 단일 Story 릴리스
/sdlc:release checkout-v2 --dry-run   # 체크리스트 문서만 생성
```

## 1단계: 인자 파싱

```bash
# 플래그 파싱
MODE="feature"    # 기본값
DRY_RUN=false
POS_ARGS=()

for a in "$@"; do
  case "$a" in
    --story)   MODE="story" ;;
    --feature) MODE="feature" ;;
    --dry-run) DRY_RUN=true ;;
    --*)       echo "⚠️ 알 수 없는 플래그: $a" ;;
    *)         POS_ARGS+=("$a") ;;
  esac
done

FIRST_ARG="${POS_ARGS[0]:-}"

# E\d+-S\d+ 패턴이면 --story 자동 감지
if [[ "$FIRST_ARG" =~ ^E[0-9]+-S[0-9]+$ ]]; then
  MODE="story"
  STORY_ID="$FIRST_ARG"
fi
```

### Plan 경로 resolve

```bash
if [[ "$MODE" == "story" ]]; then
  # Story 모드: 두 번째 위치 인자 또는 current feature로 Plan resolve
  PLAN_ARG="${POS_ARGS[1]:-}"
else
  # Feature 모드: 첫 번째 위치 인자로 Plan resolve
  PLAN_ARG="${POS_ARGS[0]:-}"
fi

OUT=$(bash "${CLAUDE_PLUGIN_ROOT}/scripts/resolve-plan-path.sh" "$PLAN_ARG") || exit 1
NAME=$(sed -n 1p <<<"$OUT")
PLAN=$(sed -n 2p <<<"$OUT")
test -f "$PLAN" || { echo "❌ Plan 파일이 없습니다: $PLAN"; exit 1; }

TODAY=$(date +%Y-%m-%d)
RELEASE_DOC="${CLAUDE_PROJECT_DIR}/docs/releases/release-${NAME}-${TODAY}.md"
mkdir -p "${CLAUDE_PROJECT_DIR}/docs/releases"
```

### dry-run 모드 안내

`DRY_RUN=true` 이면 아래 메시지 출력 후 실제 파일 읽기·체크 없이 체크리스트 구조만 생성:

```
🔍 dry-run 모드: 실제 파일 상태 확인 없이 체크리스트 문서 구조만 생성합니다.
```
```

- [ ] **Step 2: 파일이 올바르게 생성됐는지 확인**

```bash
head -5 commands/release.md
# 예상 출력:
# ---
# argument-hint: [Story ID | feature이름, 생략 시 current] [--story | --feature] [--dry-run]
# description: Phase-Gate 릴리스 체크리스트 ...
```

- [ ] **Step 3: 커밋**

```bash
git add commands/release.md
git commit -m "feat(release): 커맨드 파일 기반 구조 — frontmatter·인자 파싱"
```

---

## Task 2: Phase 1 Pre-release 구현

**Files:**
- Modify: `commands/release.md` (Phase 1 섹션 추가)

- [ ] **Step 1: Phase 1 섹션을 파일 끝에 추가**

`commands/release.md` 파일 끝에 아래를 추가한다:

```markdown
## 2단계: Phase 1 — Pre-release 검증

> 목적: 배포 전 기술적 준비 상태를 확인한다.

### 자동 수집

Plan 파일을 `Read` 로 읽어 다음 정보를 수집한다:

**Feature 모드(`--feature`):**
```bash
# 미완료 Story 체크 ([ ] 또는 [~] 상태)
grep -E '^\s*- \[[ ~]\]' "$PLAN" | grep -i "story\|E[0-9]+-S[0-9]+"
```
미완료 Story가 1개라도 있으면:
```
❌ Phase 1 실패: 미완료 Story가 있습니다.
   미완료: E2-S3 결제 취소 플로우, E2-S4 환불 처리
   → 모든 Story를 완료한 뒤 다시 실행하세요.
```
중단.

**Story 모드(`--story`):**
```bash
# complete.md 존재 여부 확인
COMPLETE_FILE="${CLAUDE_PROJECT_DIR}/docs/plans/${NAME}/${STORY_ID}/complete.md"
test -f "$COMPLETE_FILE" || echo "⚠️ complete.md 없음: /sdlc:story complete 를 먼저 실행하세요."

# PR 드래프트 존재 여부
PR_DRAFT="${CLAUDE_PROJECT_DIR}/docs/pr-drafts/${STORY_ID}.md"
test -f "$PR_DRAFT" && echo "✅ PR 드래프트 확인: $PR_DRAFT" || echo "⚠️ PR 드래프트 없음: /sdlc:pr 를 먼저 실행하세요."
```

### 사용자 확인 체크리스트

자동 수집 후 아래를 **출력하고 사용자 응답을 기다린다**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 Phase 1: Pre-release 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 항목을 모두 확인했으면 "확인" 또는 각 번호를 입력하세요.
미완료 항목이 있으면 해당 번호와 사유를 알려주세요.

[ ] 1. PR이 base 브랜치(main/master)에 머지됐음
[ ] 2. 스테이징 환경에서 주요 플로우 직접 확인
[ ] 3. 스테이징에서 AC 시나리오 재검증 완료
[ ] 4. 롤백 방법을 알고 있음 (이전 버전 태그 또는 이전 이미지)
```

**사용자 응답 처리:**
- "확인" 또는 "1234" 또는 "모두" → 4개 항목 전부 통과, Phase 2 진행
- 특정 번호 미포함 또는 "2번 아직" 등 → 해당 항목 미완료로 기록 후 중단:

```
❌ Phase 1 실패: 항목 2, 3이 확인되지 않았습니다.
   → 스테이징 확인 후 /sdlc:release 를 다시 실행하세요.
```

**dry-run 모드:** 사용자 응답 없이 4개 항목 모두 `[ ]` 상태로 문서에 기록 후 계속 진행.
```

- [ ] **Step 2: 스펙 대조 확인**

`docs/specs/2026-04-23-release-command-design.md` 섹션 4(Phase 1)의 모든 요구사항이 구현됐는지 확인:
- ✅ 자동 수집: complete.md, pr-drafts, 미완료 Story
- ✅ 사용자 확인 4개 항목
- ✅ 실패 조건 및 중단 메시지

- [ ] **Step 3: 커밋**

```bash
git add commands/release.md
git commit -m "feat(release): Phase 1 Pre-release 검증 섹션 추가"
```

---

## Task 3: Phase 2 Go/No-go Gate 구현

**Files:**
- Modify: `commands/release.md` (Phase 2 섹션 추가)

- [ ] **Step 1: Phase 2 섹션을 파일 끝에 추가**

```markdown
## 3단계: Phase 2 — Go/No-go Gate

> 목적: T'Challa(PM)와 Thor(Platform) 두 관점에서 비즈니스·인프라 준비 상태를 확인한다.

메인 Claude가 두 페르소나 역할을 수행한다. 하나의 응답 안에서 완료.

### T'Challa (PM) — 비즈니스 관점

Plan의 PRD 파일(`docs/prd/prd-<name>.md`)을 읽어 KPI·출시 기준을 파악한 뒤 아래 항목을 점검한다:

```
📋 T'Challa (PM) — 비즈니스 관점 Go/No-go

점검 항목:
- 이해관계자 사전 공지 완료 여부
- 출시 타이밍이 마케팅·외부 일정과 충돌하지 않는지
- KPI 측정 방법이 준비됐는지 (배포 후 무엇을 볼 것인가)
- 지원팀(CS)에 변경 내용이 공유됐는지

→ [GO ✅ | NO-GO ❌] + 사유 한 줄
```

사유 예시:
```
📋 T'Challa (PM): GO ✅
사유: 이해관계자 공지 완료, KPI 대시보드(결제 전환율·에러율) 준비됨, CS 팀 사전 브리핑 완료.
```

NO-GO 예시:
```
📋 T'Challa (PM): NO-GO ❌
사유: CS 팀 공지 미완료. 결제 플로우 변경 내용을 공유한 뒤 재실행하세요.
재시도 조건: CS 팀 공지 완료 후 /sdlc:release 재실행.
```

### Thor (Platform) — 인프라 관점

Plan의 architecture 파일(`docs/architecture/architecture-<name>.md`)을 읽어 DB 마이그레이션·인프라 의존성을 파악한 뒤 점검한다:

```
⚡ Thor (Platform) — 인프라 관점 Go/No-go

점검 항목:
- 모니터링 대시보드·알람이 설정됐는지
- 배포 대상 환경의 리소스 여유가 충분한지
- DB 마이그레이션이 있다면 온라인 마이그레이션이 스테이징에서 검증됐는지
- 롤백 실행 방법이 runbook 또는 docs/guides/에 존재하는지

→ [GO ✅ | NO-GO ❌] + 사유 한 줄
```

### 최종 판정

두 페르소나 발언 후 진행자가 판정:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚦 Phase 2 최종 판정
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
T'Challa: GO ✅
Thor:     GO ✅
─────────────────────────────────────
최종:     GO ✅ → Phase 3 진행
```

하나라도 NO-GO 이면:
```
최종: NO-GO ❌
→ 위 사유를 해결한 뒤 /sdlc:release 를 다시 실행하세요.
```
중단.
```

- [ ] **Step 2: 스펙 대조 확인**

`docs/specs/2026-04-23-release-command-design.md` 섹션 5(Phase 2) 요구사항 확인:
- ✅ T'Challa 점검 항목 4개
- ✅ Thor 점검 항목 4개
- ✅ 최종 판정 출력 형식
- ✅ NO-GO 시 재시도 조건 명시 및 중단

- [ ] **Step 3: 커밋**

```bash
git add commands/release.md
git commit -m "feat(release): Phase 2 Go/No-go Gate 섹션 추가"
```

---

## Task 4: Phase 3 Post-release 구현

**Files:**
- Modify: `commands/release.md` (Phase 3 섹션 추가)

- [ ] **Step 1: Phase 3 섹션을 파일 끝에 추가**

```markdown
## 4단계: Phase 3 — Post-release

> 목적: 배포 명령을 안내하고, 릴리스 노트와 롤백 기준을 문서화한다.

### 버전 번호 자동 제안

```bash
LATEST_TAG=$(git describe --tags --abbrev=0 2>/dev/null || echo "")
if [[ -z "$LATEST_TAG" ]]; then
  SUGGESTED_VERSION="v0.1.0"
else
  # 패치 버전 +1 제안 (예: v1.2.3 → v1.2.4)
  SUGGESTED_VERSION=$(echo "$LATEST_TAG" | awk -F. '{print $1"."$2"."$3+1}')
fi
```

출력:
```
🏷️ 현재 최신 태그: v1.2.3
   제안 버전: v1.2.4 (다른 버전을 원하면 직접 입력하세요)
```

버전을 사용자에게 확인받거나 dry-run 시 제안 버전 그대로 사용.

### 릴리스 노트 자동 생성

**Feature 모드:** Plan 파일에서 완료된 Story(`[x]`) 목록 추출:

```bash
grep -E '^\s*- \[x\].*E[0-9]+-S[0-9]+' "$PLAN"
```

각 Story의 제목에서 타입을 추론:
- 제목에 "수정", "fix", "bug", "버그", "오류" 포함 → `fix`
- 제목에 "리팩토링", "refactor", "개선" 포함 → `refactor`
- 그 외 → `feat` (기본값)
- `complete.md` 없으면 Plan 파일의 Story 제목만 사용

**Story 모드:** 해당 Story의 `complete.md`에서 제목 추출.

출력 형식:
```markdown
## 변경 내역 — checkout-v2 (2026-04-23)

- feat: E1-S1 토큰 기반 인증 스키마
- feat: E1-S2 이메일 인증 플로우
- fix:  E1-S3 세션 만료 엣지케이스
```

### 배포 명령 안내

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Phase 3: 배포 명령 안내
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 명령을 순서대로 실행하세요 (Claude는 실행하지 않습니다):

# 1. Git 태그 생성 및 push
git tag v1.2.4
git push origin v1.2.4

# 2. 배포
#    CI/CD 파이프라인이 태그 push를 감지하여 자동 배포되는 경우: 위에서 완료
#    수동 배포: docs/guides/development-workflow.md 의 배포 섹션 참조

# 3. 배포 확인
#    모니터링 대시보드에서 에러율·응답시간 확인 (배포 후 15분)
```

### 롤백 기준 및 명령어

```markdown
## 롤백 기준

다음 중 하나라도 해당 시 즉시 롤백을 고려하세요:
- 에러율 평소 대비 2배 이상, 5분 지속
- p95 응답시간 SLO 초과, 10분 지속
- 핵심 기능(결제·로그인 등) 동작 불가

## 롤백 명령

# 방법 1: 이전 태그 재배포 (권장)
git push origin :refs/tags/v1.2.4          # 현재 태그 삭제
git tag v1.2.4 v1.2.3                      # 이전 버전으로 태그 이동
git push origin v1.2.4

# 방법 2: 머지 커밋 되돌리기
git revert <merge-commit-hash> --no-edit
git push origin main

# 참고: 인시던트 발생 시 /sdlc:hotfix 사용
```
```

- [ ] **Step 2: 스펙 대조 확인**

`docs/specs/2026-04-23-release-command-design.md` 섹션 6(Phase 3) 요구사항 확인:
- ✅ 버전 번호 자동 제안 (git tag 기반)
- ✅ 릴리스 노트 자동 생성 (complete.md에서 추출)
- ✅ 배포 명령 안내 (실행은 사용자)
- ✅ 롤백 기준 3가지 + 명령어

- [ ] **Step 3: 커밋**

```bash
git add commands/release.md
git commit -m "feat(release): Phase 3 Post-release 섹션 추가"
```

---

## Task 5: 산출물 저장 + 최종 보고 + 에러 처리

**Files:**
- Modify: `commands/release.md` (산출물 저장·최종 보고·에러 처리 추가)

- [ ] **Step 1: 산출물 저장 섹션 추가**

```markdown
## 5단계: 산출물 저장

위 Phase 1~3 결과를 `$RELEASE_DOC` 에 저장한다.

문서 형식:

```markdown
# Release: {NAME} — {TODAY}

- **타입**: feature | story
- **대상**: {NAME} | {STORY_ID}
- **버전**: v{X.Y.Z}
- **릴리스일**: {TODAY}

---

## Phase 1: Pre-release ✅

| 항목 | 상태 |
|------|------|
| PR 머지 확인 | ✅ |
| 스테이징 플로우 확인 | ✅ |
| 스테이징 AC 재검증 | ✅ |
| 롤백 방법 확인 | ✅ |

---

## Phase 2: Go/No-go ✅

| 역할 | 판정 | 사유 |
|------|------|------|
| T'Challa (PM) | GO ✅ | {사유} |
| Thor (Platform) | GO ✅ | {사유} |
| **최종** | **GO** | — |

---

## Phase 3: 배포

### 변경 내역

- feat: E1-S1 ...
- fix:  E1-S2 ...

### 배포 명령

```bash
git tag v{X.Y.Z} && git push origin v{X.Y.Z}
```

### 롤백 기준

- 에러율 평소 대비 2배 이상, 5분 지속
- p95 응답시간 SLO 초과, 10분 지속
- 핵심 기능 동작 불가

### 롤백 명령

```bash
git push origin :refs/tags/v{X.Y.Z}
git tag v{X.Y.Z} v{PREV_VERSION}
git push origin v{X.Y.Z}
```
```

저장 완료 후 최종 보고:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ 릴리스 준비 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
대상:    {NAME} ({타입})
버전:    v{X.Y.Z}
문서:    docs/releases/release-{NAME}-{TODAY}.md

Phase 1: ✅ Pre-release 검증 통과
Phase 2: ✅ GO (T'Challa ✅ / Thor ✅)
Phase 3: 📋 배포 명령 안내 완료

다음 액션:
  git tag v{X.Y.Z} && git push origin v{X.Y.Z}
  → 배포 후 15분간 모니터링 대시보드 확인
  → 문제 발생 시: /sdlc:hotfix
  → 프로젝트 종료 시: /sdlc:retrospective
```

## 에러 처리

| 상황 | 처리 |
|------|------|
| Plan 파일 없음 | `❌ Plan 파일이 없습니다: {경로}` 출력 후 중단 |
| git repo 아님 | `❌ git 저장소가 아닙니다` 출력 후 중단 |
| Phase 1 미통과 | 사유 출력, 해결 방법 제시 후 중단 |
| Phase 2 NO-GO | 사유 출력, 재시도 조건 명시 후 중단 |
| docs/releases/ 없음 | `mkdir -p` 로 자동 생성 |

## 주의사항

- **Claude는 실제 배포 명령을 실행하지 않는다** — 명령어 안내만
- **Force push 절대 금지**
- dry-run 모드에서는 파일 저장만 하고 사용자 응답 대기 없음
- Phase 1·2 중단 시에도 그 시점까지의 결과를 산출물에 기록 (재시도 추적용)
```

- [ ] **Step 2: 스펙 대조 최종 확인**

섹션 7(산출물), 섹션 9(범위 밖) 요구사항 확인:
- ✅ `docs/releases/release-<name>-<YYYY-MM-DD>.md` 산출물
- ✅ 3-Phase 결과 문서 구조 (Phase 1 체크리스트, Phase 2 판정 표, Phase 3 변경 내역·롤백)
- ✅ 실제 배포 명령 실행 없음 (범위 밖)
- ✅ 다음 단계 안내 (`/sdlc:hotfix`, `/sdlc:retrospective`)

- [ ] **Step 3: 커밋**

```bash
git add commands/release.md
git commit -m "feat(release): 산출물 저장·최종 보고·에러 처리 추가"
```

---

## Task 6: init.md 업데이트

**Files:**
- Modify: `commands/init.md` (docs/releases/ 디렉터리 추가)

- [ ] **Step 1: init.md의 디렉터리 생성 명령 수정**

`commands/init.md` 에서 아래 줄을 찾아:

```bash
mkdir -p "${CLAUDE_PROJECT_DIR}/docs"/{features,prd,architecture,plans,plans/archive,plans/scope-changes,meetings,retrospectives,standups,pr-drafts,onboarding,guides,standards}
```

`releases` 를 추가한 줄로 교체:

```bash
mkdir -p "${CLAUDE_PROJECT_DIR}/docs"/{features,prd,architecture,plans,plans/archive,plans/scope-changes,meetings,retrospectives,standups,pr-drafts,onboarding,guides,standards,releases}
```

- [ ] **Step 2: 변경 확인**

```bash
grep "releases" commands/init.md
# 예상 출력: ...plans/scope-changes,meetings,retrospectives,standups,pr-drafts,onboarding,guides,standards,releases}
```

- [ ] **Step 3: 커밋**

```bash
git add commands/init.md
git commit -m "feat(init): docs/releases/ 디렉터리 생성 추가"
```

---

## 완료 확인

- [ ] `commands/release.md` 존재 확인: `ls commands/release.md`
- [ ] frontmatter 형식 확인: `head -5 commands/release.md`
- [ ] init.md releases 포함 확인: `grep releases commands/init.md`
- [ ] 스펙 섹션 전체 커버 확인: spec 문서와 대조
