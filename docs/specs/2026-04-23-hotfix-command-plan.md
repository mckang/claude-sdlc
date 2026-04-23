# /sdlc:hotfix 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 프로덕션 긴급 수정을 두 모드(기본/긴급)로 안내하는 `/sdlc:hotfix` 커맨드를 구현한다.

**Architecture:** 단일 마크다운 커맨드 파일. 인자 파싱 후 `MODE=standard`(기본)와 `MODE=emergency`(`--emergency`) 두 경로로 분기한다. Feature Stack (`scripts/feature-stack.sh`)으로 current feature를 push/pop 처리한다. 마지막 단계에서 두 모드가 합류해 공통 산출물 문서를 생성한다.

**Tech Stack:** Markdown procedure file, Bash (인자 파싱·git 명령·파일 읽기), `scripts/feature-stack.sh`

**Spec:** `docs/specs/2026-04-23-hotfix-command-design.md`

---

## 변경 파일 목록

| 작업 | 파일 | 내용 |
|------|------|------|
| Create | `commands/hotfix.md` | hotfix 커맨드 전체 |
| Modify | `commands/init.md` | `/sdlc:hotfix` 커맨드 목록 추가 |

---

## Task 1: 커맨드 파일 기반 구조 — frontmatter + 인자 파싱 + feature push

**Files:**
- Create: `commands/hotfix.md`

- [ ] **Step 1: 파일 생성 — frontmatter + 인트로**

`commands/hotfix.md` 를 아래 내용으로 생성한다:

```markdown
---
argument-hint: [description] [--emergency] [--dry-run]
description: 프로덕션 긴급 수정 — 기본(당일 패치) 또는 --emergency(즉각 대응) 두 모드 지원
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Hotfix

사용자가 `/sdlc:hotfix [description] [--emergency] [--dry-run]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
\```
/sdlc:hotfix                                  # 기본 모드, description 대화 수집
/sdlc:hotfix login-timeout-fix                # 기본 모드, description 지정
/sdlc:hotfix login-timeout-fix --emergency    # 긴급 모드
/sdlc:hotfix login-timeout-fix --dry-run      # 문서 구조만 생성
\```

## 1단계: 인자 파싱

\```bash
MODE="standard"   # 기본값
DRY_RUN=false
POS_ARGS=()

for a in "$@"; do
  case "$a" in
    --emergency) MODE="emergency" ;;
    --dry-run)   DRY_RUN=true ;;
    --*)         echo "⚠️ 알 수 없는 플래그: $a" ;;
    *)           POS_ARGS+=("$a") ;;
  esac
done

DESCRIPTION="${POS_ARGS[0]:-}"
TODAY=$(date +%Y-%m-%d)
\```

### description 수집

`DESCRIPTION` 이 비어 있으면 사용자에게 묻는다:

\```
어떤 문제가 발생했나요? 한 줄로 설명해 주세요 (예: login-timeout-fix):
\```

응답을 받아 공백을 하이픈으로 치환해 `$DESCRIPTION` 에 저장한다.

\```bash
DESCRIPTION=$(echo "$DESCRIPTION" | tr ' ' '-' | tr '[:upper:]' '[:lower:]')
\```

### 영향 범위 수집

\```
영향받는 사용자/기능은 무엇인가요? (간단히):
\```

응답을 `$IMPACT` 에 저장한다.

### Current Feature push

\```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" push "hotfix/${DESCRIPTION}"
\```

이 명령은 현재 current feature를 Feature Stack에 저장하고, current feature를 `hotfix/<description>` 으로 설정한다.

### 산출물 경로 설정

\```bash
RELEASE_DOC="${CLAUDE_PROJECT_DIR}/docs/releases/hotfix-${DESCRIPTION}-${TODAY}.md"
mkdir -p "${CLAUDE_PROJECT_DIR}/docs/releases"
\```

### dry-run 모드 안내

`DRY_RUN=true` 이면 아래 메시지 출력:

\```
🔍 dry-run 모드: 실제 파일 상태 확인 없이 문서 구조만 생성합니다.
\```
```

- [ ] **Step 2: 커밋**

```bash
git add commands/hotfix.md
git commit -m "feat(hotfix): 커맨드 파일 기반 구조 — frontmatter·인자 파싱·feature push"
```

---

## Task 2: 기본 모드 — Phase 1(문제 정의) + Phase 2(구현 & PR 체크리스트)

**Files:**
- Modify: `commands/hotfix.md`

- [ ] **Step 1: 기본 모드 분기 시작 + Phase 1 append**

`commands/hotfix.md` 끝에 아래 내용을 추가한다:

````markdown
## 기본 모드 (MODE=standard)

`MODE=standard` 이면 아래 절차를 순서대로 따른다.

### 2단계: Phase 1 — 문제 정의 (기본 모드)

> 목적: hotfix 브랜치 전략을 안내하고 수정 준비를 돕는다.

다음 내용을 출력한다 (사용자가 직접 실행):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Hotfix 브랜치 생성 안내
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 명령어를 직접 실행하세요:

git checkout main && git pull origin main
git checkout -b hotfix/<DESCRIPTION>
```

(`<DESCRIPTION>` 자리에 실제 `$DESCRIPTION` 값을 출력한다.)

### 3단계: Phase 2 — 구현 & PR 체크리스트 (기본 모드)

> 목적: 수정 완료 및 머지까지 확인한다.

아래를 **출력하고 사용자 응답을 기다린다** (`DRY_RUN=false` 일 때):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Hotfix 구현 & PR 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 항목을 모두 확인했으면 "확인" 또는 "12345"를 입력하세요.
미완료 항목이 있으면 해당 번호와 사유를 알려주세요.

[ ] 1. hotfix 브랜치에서 수정 완료
[ ] 2. 로컬 테스트 통과
[ ] 3. 스테이징에서 검증 완료
[ ] 4. PR 생성 후 최소 1인 리뷰 & 승인 받음
[ ] 5. PR이 main에 머지됨
```

**사용자 응답 처리:**
- "확인", "12345", "모두", "all", "ok" → 5개 항목 전부 통과, `STD_CHECKLIST_RESULT="✅ 5/5 통과"` 기록, Phase 3 진행
- 미완료 항목 있음 → 해당 항목 명시 후 중단:

```
❌ 체크리스트 미완료: 항목 (번호)이 확인되지 않았습니다.
   → 해당 항목 완료 후 /sdlc:hotfix 를 다시 실행하세요.
```

**dry-run 모드:** 사용자 응답 없이 5개 항목 모두 `[ ]` 상태로 `STD_CHECKLIST_RESULT="[dry-run]"` 기록 후 계속 진행.
````

- [ ] **Step 2: 커밋**

```bash
git add commands/hotfix.md
git commit -m "feat(hotfix): 기본 모드 Phase 1·2 — 브랜치 안내·체크리스트"
```

---

## Task 3: 기본 모드 — Phase 3 (배포 & 문서화)

**Files:**
- Modify: `commands/hotfix.md`

- [ ] **Step 1: 기본 모드 Phase 3 append**

`commands/hotfix.md` 끝에 아래 내용을 추가한다:

````markdown
### 4단계: Phase 3 — 배포 & 문서화 (기본 모드)

> 목적: 버전 태그 안내 후 문서를 생성하고 current feature를 원복한다.
> 이 단계는 한 번 진입하면 중단 없이 끝까지 완료한다.

#### Git 태그 안내

다음 명령어를 실행하여 최신 태그를 확인한다 (이 명령은 조회 전용이므로 Bash로 실행한다):

```bash
git tag --sort=-v:refname | head -1
```

**버전 결정 규칙:**
- 태그가 없으면 → `v0.1.0` 제안
- 태그가 있으면 → patch 버전을 1 올린다 (예: `v1.2.3` → `v1.2.4`)

결정된 버전을 `$VERSION` 변수에 저장한다.

`DRY_RUN=true` 이면 Bash 실행 없이 `VERSION="v0.0.0-dry-run"` 으로 설정한다.

아래 명령어는 사용자가 직접 실행한다 — Claude는 실행하지 않는다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 배포 안내 (기본 모드)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제안 버전: v<X.Y.Z>

아래 명령어를 직접 실행하세요:

# 1. Git 태그
git tag v<X.Y.Z> && git push origin v<X.Y.Z>

# 2. 배포
#    CI/CD 파이프라인이 태그 push로 자동 트리거되는 경우: 위로 완료
#    수동 배포가 필요한 경우: docs/guides/development-workflow.md 참조
```

(`v<X.Y.Z>` 자리에 실제 `$VERSION` 값을 출력한다.)

문서 산출물 저장과 current feature 원복은 **6단계(공통)** 에서 처리한다.
````

- [ ] **Step 2: 커밋**

```bash
git add commands/hotfix.md
git commit -m "feat(hotfix): 기본 모드 Phase 3 — 배포 안내"
```

---

## Task 4: 긴급 모드 — Phase 1(Thor 체크) + Phase 2(브랜치 직접 생성)

**Files:**
- Modify: `commands/hotfix.md`

- [ ] **Step 1: 긴급 모드 분기 시작 + Phase 1 + Phase 2 append**

`commands/hotfix.md` 끝에 아래 내용을 추가한다:

````markdown
---

## 긴급 모드 (MODE=emergency)

`MODE=emergency` 이면 아래 절차를 순서대로 따른다.

### 2단계: Phase 1 — 문제 정의 & Thor 긴급 체크 (긴급 모드)

> 목적: 롤백 준비 완료 여부를 즉시 확인한 뒤 브랜치 생성으로 넘어간다.

`DRY_RUN=true` 이면 Thor GO를 자동 통과한다:

```bash
THOR_RESULT="Thor: GO — [dry-run — 실제 확인 생략]"
```

`DRY_RUN=false` 일 때, 아래를 **출력하고 사용자 응답을 기다린다**:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Thor (Platform): 긴급 배포 전 확인
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 항목을 모두 확인했으면 "확인" 또는 "12"를 입력하세요.
미완료 항목이 있으면 해당 번호와 사유를 알려주세요.

[ ] 1. 롤백 방법을 알고 있음 (이전 태그 또는 이전 이미지)
[ ] 2. 모니터링 대시보드 확인 중
```

**사용자 응답 처리:**
- "확인", "12", "모두", "all", "ok" → Thor GO:

  ```
  ⚡ Thor (Platform): GO ✅
  사유: 롤백 준비됨, 모니터링 확인.
  ```

  ```bash
  THOR_RESULT="Thor: GO — 롤백 준비됨, 모니터링 확인"
  ```

  Phase 2 진행.

- 미완료 항목 있음 → Thor NO-GO, 즉시 중단:

  ```bash
  THOR_RESULT="Thor: NO-GO — 긴급 배포 전 롤백 준비 미완료"
  ```

  ```
  🛑 Thor: NO-GO — 긴급 배포 전 롤백 준비가 필요합니다.
  → 롤백 방법 확인 후 /sdlc:hotfix --emergency 를 다시 실행하세요.
  → 또는 지금 바로 롤백: git revert <commit> 또는 이전 태그 재배포
  ```

### 3단계: Phase 2 — 브랜치 직접 생성 (긴급 모드)

> 목적: Claude가 hotfix 브랜치를 즉시 생성한다.

`DRY_RUN=false` 이면 다음 명령을 Bash로 실행한다:

```bash
git checkout main && git pull origin main
git checkout -b hotfix/<DESCRIPTION>
```

(`<DESCRIPTION>` 자리에 실제 `$DESCRIPTION` 값을 사용한다.)

실행 후 확인 메시지를 출력한다:

```
✅ 브랜치 생성 완료: hotfix/<DESCRIPTION>
→ 지금 이 브랜치에서 수정을 진행하세요.
```

`DRY_RUN=true` 이면 위 명령어를 출력만 하고 실행하지 않는다:

```
🔍 [dry-run] 실행할 명령어:
git checkout main && git pull origin main
git checkout -b hotfix/<DESCRIPTION>
```
````

- [ ] **Step 2: 커밋**

```bash
git add commands/hotfix.md
git commit -m "feat(hotfix): 긴급 모드 Phase 1(Thor 체크)·2(브랜치 직접 생성)"
```

---

## Task 5: 긴급 모드 — Phase 3(구현 & PR) + Phase 4(즉시 배포)

**Files:**
- Modify: `commands/hotfix.md`

- [ ] **Step 1: 긴급 모드 Phase 3 + Phase 4 append**

`commands/hotfix.md` 끝에 아래 내용을 추가한다:

````markdown
### 4단계: Phase 3 — 구현 & PR 체크리스트 (긴급 모드)

> 목적: 최소 1인 리뷰를 포함한 수정 완료를 확인한다.

아래를 **출력하고 사용자 응답을 기다린다** (`DRY_RUN=false` 일 때):

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 긴급 Hotfix 구현 & PR 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

아래 항목을 모두 확인했으면 "확인" 또는 "12345"를 입력하세요.
미완료 항목이 있으면 해당 번호와 사유를 알려주세요.

[ ] 1. hotfix 브랜치에서 수정 완료
[ ] 2. 로컬 테스트 통과
[ ] 3. 스테이징 검증 (긴급 시 생략 가능 — 사용자 판단)
[ ] 4. PR 생성 후 최소 1인 리뷰 & 승인 (필수, 생략 불가)
[ ] 5. PR이 main에 머지됨
```

**사용자 응답 처리:**
- "확인", "12345", "모두", "all", "ok" → 5개 항목 전부 통과, `EMG_CHECKLIST_RESULT="✅ 5/5 통과"` 기록, Phase 4 진행
- 4번(PR 리뷰) 미확인 → 중단:

  ```
  ❌ PR 리뷰는 긴급 모드에서도 필수입니다.
     → 최소 1인 리뷰 & 승인 후 /sdlc:hotfix --emergency 를 다시 실행하세요.
  ```

- 기타 미완료 항목 → 해당 번호 명시 후 중단:

  ```
  ❌ 체크리스트 미완료: 항목 (번호)이 확인되지 않았습니다.
     → 해당 항목 완료 후 /sdlc:hotfix --emergency 를 다시 실행하세요.
  ```

**dry-run 모드:** 사용자 응답 없이 5개 항목 모두 `[ ]` 상태로 `EMG_CHECKLIST_RESULT="[dry-run]"` 기록 후 계속 진행.

### 5단계: Phase 4 — 즉시 배포 (긴급 모드)

> 목적: 배포 명령 안내 및 30분 모니터링 체크리스트를 제공한다.
> 이 단계는 한 번 진입하면 중단 없이 끝까지 완료한다.

#### Git 태그 안내

다음 명령어를 실행하여 최신 태그를 확인한다 (이 명령은 조회 전용이므로 Bash로 실행한다):

```bash
git tag --sort=-v:refname | head -1
```

**버전 결정 규칙:**
- 태그가 없으면 → `v0.1.0` 제안
- 태그가 있으면 → patch 버전을 1 올린다 (예: `v1.2.3` → `v1.2.4`)

결정된 버전을 `$VERSION` 변수에 저장한다.

`DRY_RUN=true` 이면 Bash 실행 없이 `VERSION="v0.0.0-dry-run"` 으로 설정한다.

아래 명령어는 사용자가 직접 실행한다 — Claude는 실행하지 않는다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 즉시 배포 안내 (긴급 모드)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

제안 버전: v<X.Y.Z>

아래 명령어를 직접 실행하세요:

# 1. Git 태그
git tag v<X.Y.Z> && git push origin v<X.Y.Z>

# 2. 배포
#    CI/CD 파이프라인이 태그 push로 자동 트리거되는 경우: 위로 완료
#    수동 배포가 필요한 경우: docs/guides/development-workflow.md 참조
```

(`v<X.Y.Z>` 자리에 실제 `$VERSION` 값을 출력한다.)

#### 30분 모니터링 체크리스트

배포 명령 안내 후 아래를 출력한다 (사용자가 모니터링 완료 시 "확인" 입력, 또는 Enter로 스킵 가능):

```
배포 후 30분 모니터링:
[ ] 에러율 정상 범위 유지
[ ] p95 응답시간 SLO 이하
[ ] 핵심 기능 정상 동작

이상 없으면 "확인", 이상 감지 시 롤백 명령을 참조하세요:
git revert <merge-commit-hash>
```

`DRY_RUN=true` 이면 모니터링 체크리스트를 출력만 하고 응답을 기다리지 않는다.

문서 산출물 저장과 current feature 원복은 **6단계(공통)** 에서 처리한다.
````

- [ ] **Step 2: 커밋**

```bash
git add commands/hotfix.md
git commit -m "feat(hotfix): 긴급 모드 Phase 3(체크리스트)·4(즉시 배포)"
```

---

## Task 6: 공통 — 산출물 저장 + current feature 원복 + init.md 업데이트

**Files:**
- Modify: `commands/hotfix.md`
- Modify: `commands/init.md`

- [ ] **Step 1: 공통 산출물 저장 섹션 append**

`commands/hotfix.md` 끝에 아래 내용을 추가한다:

````markdown
---

## 6단계: 산출물 저장 및 완료 보고 (공통)

> 기본 모드와 긴급 모드 모두 이 단계에서 합류한다.
> 이 단계는 항상 완주한다.

### 롤백 기준 수집

머지 커밋 해시를 사용자에게 요청한다:

```
머지 커밋 해시를 입력해 주세요 (모르면 Enter 스킵):
```

- 입력 시 `$MERGE_HASH` 에 저장
- 스킵 시 `$MERGE_HASH="<merge-commit-hash>"` (플레이스홀더)

`DRY_RUN=true` 이면 프롬프트 없이 `$MERGE_HASH="<merge-commit-hash>"` 로 설정한다.

### 릴리스 문서 작성

`Write` 도구를 사용하여 `$RELEASE_DOC` 경로에 아래 문서를 생성한다.

기본 모드 (`MODE=standard`) 문서:

```markdown
# Hotfix: <DESCRIPTION> — <TODAY>

- 모드: standard
- 버전: <VERSION>
- 영향 범위: <IMPACT>

## 문제 정의

<DESCRIPTION>

영향 범위: <IMPACT>

## 수정 내용

- (수정 내용 — 필요 시 직접 보완)

## 배포

- 브랜치: hotfix/<DESCRIPTION>
- PR: (PR 링크 또는 번호 — 필요 시 직접 보완)
- 배포 시각: (배포 후 직접 기록)

## 구현 체크리스트

<STD_CHECKLIST_RESULT>

## 롤백 기준

판단 기준 (하나라도 해당 시):
- 에러율 평소 대비 2배 이상, 5분 지속
- p95 응답시간 SLO 초과, 10분 지속
- 핵심 기능(결제·로그인 등) 동작 불가

아래는 롤백 시 사용자가 직접 실행할 명령어이며 Claude는 실행하지 않는다:
git revert <MERGE_HASH>
# 또는 이전 태그 재배포

## 사후 분석 (Post-mortem)

### 근본 원인
(작성 필요)

### 재발 방지 조치
(작성 필요)

### 타임라인
(작성 필요)
```

긴급 모드 (`MODE=emergency`) 는 위 구조에 아래 섹션을 추가한다 (`## 구현 체크리스트` 앞에 삽입):

```markdown
## Go/No-go

<THOR_RESULT>

## 구현 체크리스트

<EMG_CHECKLIST_RESULT>
```

### Current Feature 원복

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" pop
```

이 명령은 Feature Stack에서 이전 current feature를 꺼내 복원한다.

### 최종 보고 출력

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Hotfix 완료
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

대상: hotfix/<DESCRIPTION> (<MODE>)
버전: <VERSION>
문서: <RELEASE_DOC>

📌 다음 단계:
1. 배포 명령 실행 (위 안내 참조)
2. 배포 후 30분 모니터링
3. 이상 감지 시: 롤백 기준 참조 (git revert <MERGE_HASH>)
4. 사후 분석 (Post-mortem) 문서 보완: <RELEASE_DOC>
```

`DRY_RUN=true 이면` 아래를 추가 출력한다:

```
🔍 dry-run 모드로 실행됨 — 실제 확인 없이 문서만 생성되었습니다.
```
````

- [ ] **Step 2: init.md 업데이트**

`commands/init.md` 에서 `/sdlc:release` 항목 바로 뒤에 hotfix를 추가한다:

현재:
```
- `/sdlc:release` — Phase-Gate 릴리스 (Pre-release → Go/No-go → 배포 안내)
```

변경 후:
```
- `/sdlc:release` — Phase-Gate 릴리스 (Pre-release → Go/No-go → 배포 안내)
- `/sdlc:hotfix` — 프로덕션 긴급 수정 (기본 모드 또는 --emergency 즉각 대응)
```

- [ ] **Step 3: 커밋**

```bash
git add commands/hotfix.md commands/init.md
git commit -m "feat(hotfix): 공통 산출물 저장·current feature 원복·init.md 업데이트"
```
