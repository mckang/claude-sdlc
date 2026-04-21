# Project Owner Init Prompt Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/sdlc:init` 실행 시 프로젝트 오너 이름을 대화식으로 입력받아 CLAUDE.md에 기록하고, `commands/meeting.md`의 하드코딩된 "Thomas" 참조를 제거한다.

**Architecture:** 템플릿 CLAUDE.md 하단에 `{NAME}` 플레이스홀더가 포함된 "프로젝트 오너" 섹션을 추가하고, `commands/init.md`의 5단계를 재작성해 대화식 프롬프트 + 신규 생성/기존 append 두 경로를 분기 처리한다. `commands/meeting.md`는 "CLAUDE.md의 프로젝트 오너 섹션"을 참조하도록 변경 — CLAUDE.md가 세션 자동 로드 대상이므로 추가 Read는 불필요하다.

**Tech Stack:** Claude Code 플러그인 (슬래시 커맨드 Markdown + bash), JSON 버전 메타데이터.

**Spec:** [docs/superpowers/specs/2026-04-21-project-owner-init-prompt-design.md](../specs/2026-04-21-project-owner-init-prompt-design.md)

---

## 프로젝트 구조 (File Structure)

- **Modify**: `templates/CLAUDE.md` — 하단에 오너 섹션 append (플레이스홀더 포함)
- **Modify**: `commands/init.md` — 5단계 전체 재작성 (대화식 프롬프트 + 분기 로직)
- **Modify**: `commands/meeting.md` — 31행, 190행의 "Thomas" 참조 제거
- **Modify**: `.claude-plugin/plugin.json` — 버전 1.0.1 → 1.0.2
- **Modify**: `.claude-plugin/marketplace.json` — 버전 1.0.1 → 1.0.2 (동기화)

테스트 측면: 이 프로젝트는 Claude Code 슬래시 커맨드 플러그인이라 자동 테스트 스위트가 없다. **Task 5 (수동 검증)** 에서 실제 `/sdlc:init` 을 샘플 디렉토리에서 dry-run 방식으로 확인한다.

---

## Task 1: 템플릿 CLAUDE.md에 오너 섹션 추가

**Files:**
- Modify: `templates/CLAUDE.md` (파일 끝, 63행 이후)

- [ ] **Step 1: 현재 파일 끝 확인**

Run: `tail -5 templates/CLAUDE.md`
Expected: 파일이 커맨드 참조 블록의 ``` 백틱으로 끝남.

- [ ] **Step 2: 오너 섹션 append**

파일 **맨 끝**에 다음 내용을 추가 (기존 내용 보존, 단순 append). 최종 파일 끝이 아래와 같아야 한다:

```markdown
/sdlc:roles                                        # 페르소나 목록
```

---

## 프로젝트 오너
- **이름**: {NAME}
- **역할**: 최종 의사결정자. 미팅·토론 중 결정이 필요하면 반드시 이 사용자에게 질의.
```

구체적으로:
- 기존 ```` ``` ```` 닫는 백틱 뒤에 빈 줄 하나
- `---` 구분선 (앞뒤 빈 줄 포함)
- `## 프로젝트 오너` 섹션 (위 내용)
- 파일은 개행으로 끝나야 함

- [ ] **Step 3: 변경 확인**

Run: `tail -10 templates/CLAUDE.md`
Expected: `## 프로젝트 오너`, `- **이름**: {NAME}`, `- **역할**: 최종 의사결정자. ...` 세 줄이 보여야 함.

Run: `grep -c '{NAME}' templates/CLAUDE.md`
Expected: `1`

- [ ] **Step 4: 커밋**

```bash
git add templates/CLAUDE.md
git commit -m "$(cat <<'EOF'
Add project owner section to CLAUDE.md template

Placeholder {NAME} will be filled by /sdlc:init based on interactive
prompt. Enables meeting.md to reference project owner per-project
instead of hardcoded plugin author.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: `commands/init.md` 5단계 재작성 (대화식 프롬프트)

**Files:**
- Modify: `commands/init.md:46-65` (5단계 전체 블록)

**맥락:** 현재 5단계는 CLAUDE.md가 없으면 `cp` 로 복사, 있으면 안내만 출력한다. 이 단계를 "이름 프롬프트 → 치환/append" 로직으로 교체한다.

- [ ] **Step 1: 현재 5단계 내용 확인**

Run: `sed -n '46,65p' commands/init.md`
Expected: `## 5단계: CLAUDE.md 처리` 로 시작하는 현재 블록.

- [ ] **Step 2: 5단계 블록 교체**

`commands/init.md` 의 5단계 전체(46–65행) 를 아래로 교체한다:

````markdown
## 5단계: CLAUDE.md 처리 (대화식)

### 5-a. 프로젝트 오너 이름 수집

사용자에게 다음을 **먼저 출력한 뒤 응답을 기다려라**:

```
이 프로젝트의 오너(최종 의사결정자) 이름을 알려주세요.
미팅·토론 중 결정이 필요할 때 Claude 가 이 사람에게 질의합니다.
(엔터만 치면 스킵)
```

사용자 응답 문자열을 `OWNER_NAME` 변수로 보관한다. 응답이 빈 문자열이면 이후의 오너 섹션 처리는 모두 생략한다.

### 5-b. CLAUDE.md 가 없을 때

템플릿을 복사한 뒤, `OWNER_NAME` 이 있으면 `{NAME}` 을 치환하고, 없으면 오너 섹션 블록 전체(`---` 구분선 포함)를 삭제한다.

```bash
DEST="${CLAUDE_PROJECT_DIR}/CLAUDE.md"
TPL="${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md"

if [ ! -f "$DEST" ]; then
  cp "$TPL" "$DEST"
  if [ -n "$OWNER_NAME" ]; then
    # sed 구분자를 | 로 사용해 이름에 / 가 있어도 안전
    ESCAPED=$(printf '%s' "$OWNER_NAME" | sed 's/[&|\\]/\\&/g')
    sed -i.bak "s|{NAME}|$ESCAPED|" "$DEST" && rm "$DEST.bak"
    echo "✓ CLAUDE.md 생성 완료 (오너: $OWNER_NAME)"
  else
    # 오너 섹션 블록 전체 제거: '---' 부터 파일 끝까지
    # 템플릿 맨 끝 '---' 구분선 이후가 오너 섹션이라는 전제
    sed -i.bak '/^---$/,$d' "$DEST" && rm "$DEST.bak"
    echo "✓ CLAUDE.md 생성 완료 (오너 섹션 스킵)"
  fi
fi
```

### 5-c. CLAUDE.md 가 이미 있을 때

기존 파일은 덮어쓰지 않는다. `OWNER_NAME` 이 있으면 파일 끝에 오너 섹션을 append 하되, 이미 `## 프로젝트 오너` 헤더가 있으면 건드리지 않는다.

```bash
if [ -f "$DEST" ]; then
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

> 주의: 위 두 블록(5-b, 5-c)은 `DEST` 존재 여부에 따라 **한쪽만** 실행되도록 `if-else` 로 묶거나 순차 실행 시 조건 분기를 명확히 할 것. 구현 시 하나의 `if [ ! -f "$DEST" ]; then ... else ... fi` 로 합치는 것을 권장.
````

- [ ] **Step 3: 변경 확인**

Run: `sed -n '46,110p' commands/init.md | head -70`
Expected: `## 5단계: CLAUDE.md 처리 (대화식)`, `### 5-a. 프로젝트 오너 이름 수집`, `{NAME}` 치환 로직, `grep -q '^## 프로젝트 오너$'` 분기가 모두 보여야 함.

Run: `grep -c 'OWNER_NAME' commands/init.md`
Expected: 4 이상 (여러 곳에서 참조됨)

- [ ] **Step 4: 커밋**

```bash
git add commands/init.md
git commit -m "$(cat <<'EOF'
Rewrite /sdlc:init step 5 with interactive owner prompt

Prompts user for project owner name and fills {NAME} placeholder in
new CLAUDE.md, or appends owner section to existing CLAUDE.md when
not already present. Empty input skips owner section entirely.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: `commands/meeting.md` 하드코딩 제거

**Files:**
- Modify: `commands/meeting.md:31`
- Modify: `commands/meeting.md:190`

- [ ] **Step 1: 현재 하드코딩 위치 확인**

Run: `grep -n 'Thomas' commands/meeting.md`
Expected:
```
31:참석자에는 적극적으로 대화에 참여하지는 않지만 필요한 의사결정을 내릴수 있는 내(Thomas)가 들어가 있어.
190:- 의사 결정이 필요한 부분이 있으면 가정하지 말고 대화도중에라도 반드시 나(Thomas)에게 물어보고 진행해줘
```

- [ ] **Step 2: 31행 교체**

Old:
```
참석자에는 적극적으로 대화에 참여하지는 않지만 필요한 의사결정을 내릴수 있는 내(Thomas)가 들어가 있어.
```

New:
```
참석자에는 적극적으로 대화에 참여하지는 않지만 필요한 의사결정을 내릴 수 있는 프로젝트 오너(CLAUDE.md 의 "프로젝트 오너" 섹션 참조)가 포함된다. 오너 섹션이 없으면 현재 사용자를 오너로 간주한다.
```

- [ ] **Step 3: 190행 교체**

Old:
```
- 의사 결정이 필요한 부분이 있으면 가정하지 말고 대화도중에라도 반드시 나(Thomas)에게 물어보고 진행해줘
```

New:
```
- 의사 결정이 필요한 부분이 있으면 가정하지 말고 대화 도중에라도 반드시 프로젝트 오너에게 물어보고 진행해줘.
```

- [ ] **Step 4: 하드코딩 제거 확인**

Run: `grep -n 'Thomas' commands/meeting.md`
Expected: 출력 없음 (매치 0개, exit code 1).

Run: `grep -n '프로젝트 오너' commands/meeting.md`
Expected: 최소 2줄 (교체한 두 문장).

- [ ] **Step 5: 커밋**

```bash
git add commands/meeting.md
git commit -m "$(cat <<'EOF'
Remove hardcoded Thomas refs from meeting command

Replace with "프로젝트 오너" references — CLAUDE.md auto-loads at
session start, so Claude reads the owner name from the project's
CLAUDE.md section written by /sdlc:init.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: 버전 bump (plugin.json, marketplace.json)

**Files:**
- Modify: `.claude-plugin/plugin.json:3`
- Modify: `.claude-plugin/marketplace.json:11`

- [ ] **Step 1: 현재 버전 확인**

Run: `grep '"version"' .claude-plugin/plugin.json .claude-plugin/marketplace.json`
Expected:
```
.claude-plugin/plugin.json:  "version": "1.0.1",
.claude-plugin/marketplace.json:      "version": "1.0.1"
```

- [ ] **Step 2: plugin.json 버전 bump**

`.claude-plugin/plugin.json` 3행:

Old:
```json
  "version": "1.0.1",
```

New:
```json
  "version": "1.0.2",
```

- [ ] **Step 3: marketplace.json 버전 bump**

`.claude-plugin/marketplace.json` 11행:

Old:
```json
      "version": "1.0.1"
```

New:
```json
      "version": "1.0.2"
```

- [ ] **Step 4: 버전 동기화 확인**

Run: `grep '"version"' .claude-plugin/plugin.json .claude-plugin/marketplace.json`
Expected:
```
.claude-plugin/plugin.json:  "version": "1.0.2",
.claude-plugin/marketplace.json:      "version": "1.0.2"
```

- [ ] **Step 5: 커밋**

```bash
git add .claude-plugin/plugin.json .claude-plugin/marketplace.json
git commit -m "$(cat <<'EOF'
Bump plugin to v1.0.2 for owner prompt feature

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: 수동 검증 (5가지 시나리오)

**Files:**
- 읽기 전용. 임시 디렉토리에서 시뮬레이션.

**목적:** 스펙의 "테스트 시나리오" 5개를 순서대로 샌드박스 디렉토리에서 재현. `/sdlc:init` 은 슬래시 커맨드라 실제 Claude Code 세션에서 돌려야 하지만, **핵심 bash 로직은 5단계의 스크립트 블록을 복사해 수동 실행**으로 검증 가능하다.

- [ ] **Step 1: 검증용 샌드박스 준비**

```bash
SANDBOX=$(mktemp -d)
export CLAUDE_PROJECT_DIR="$SANDBOX/project"
export CLAUDE_PLUGIN_ROOT="$(pwd)"
mkdir -p "$CLAUDE_PROJECT_DIR"
echo "샌드박스: $SANDBOX"
```

- [ ] **Step 2: 시나리오 1 — 신규 + 이름 입력**

```bash
rm -f "$CLAUDE_PROJECT_DIR/CLAUDE.md"
OWNER_NAME="Thomas Kang"
cp "$CLAUDE_PLUGIN_ROOT/templates/CLAUDE.md" "$CLAUDE_PROJECT_DIR/CLAUDE.md"
ESCAPED=$(printf '%s' "$OWNER_NAME" | sed 's/[&|\\]/\\&/g')
sed -i.bak "s|{NAME}|$ESCAPED|" "$CLAUDE_PROJECT_DIR/CLAUDE.md" && rm "$CLAUDE_PROJECT_DIR/CLAUDE.md.bak"
tail -5 "$CLAUDE_PROJECT_DIR/CLAUDE.md"
```

Expected: 마지막 섹션에 `- **이름**: Thomas Kang` 포함, `{NAME}` 문자열이 파일에 남아있지 않음.

Check:
```bash
grep -c '{NAME}' "$CLAUDE_PROJECT_DIR/CLAUDE.md"
```
Expected: `0`

- [ ] **Step 3: 시나리오 2 — 신규 + 이름 스킵**

```bash
rm -f "$CLAUDE_PROJECT_DIR/CLAUDE.md"
OWNER_NAME=""
cp "$CLAUDE_PLUGIN_ROOT/templates/CLAUDE.md" "$CLAUDE_PROJECT_DIR/CLAUDE.md"
sed -i.bak '/^---$/,$d' "$CLAUDE_PROJECT_DIR/CLAUDE.md" && rm "$CLAUDE_PROJECT_DIR/CLAUDE.md.bak"
tail -5 "$CLAUDE_PROJECT_DIR/CLAUDE.md"
```

Expected: 마지막 줄이 빠른 명령 참조 블록의 닫는 ` ``` ` 백틱. `## 프로젝트 오너` 나 `---` 구분선 없음.

Check:
```bash
grep -c '프로젝트 오너' "$CLAUDE_PROJECT_DIR/CLAUDE.md"
```
Expected: `0`

- [ ] **Step 4: 시나리오 3 — 기존 CLAUDE.md (섹션 없음) + append**

```bash
cat > "$CLAUDE_PROJECT_DIR/CLAUDE.md" <<'EOF'
# My Project
기존 프로젝트 규칙이 여기 있다.
EOF

OWNER_NAME="Alice"
if ! grep -q '^## 프로젝트 오너$' "$CLAUDE_PROJECT_DIR/CLAUDE.md"; then
  {
    printf '\n---\n\n## 프로젝트 오너\n'
    printf -- '- **이름**: %s\n' "$OWNER_NAME"
    printf -- '- **역할**: 최종 의사결정자. 미팅·토론 중 결정이 필요하면 반드시 이 사용자에게 질의.\n'
  } >> "$CLAUDE_PROJECT_DIR/CLAUDE.md"
fi
cat "$CLAUDE_PROJECT_DIR/CLAUDE.md"
```

Expected: 상단에 `# My Project` 와 기존 내용, 하단에 `---` 구분선 + `## 프로젝트 오너` 섹션 + `- **이름**: Alice` 포함.

- [ ] **Step 5: 시나리오 4 — 기존 CLAUDE.md (섹션 있음) + append 방지**

```bash
# 시나리오 3 의 결과물을 그대로 이어서 사용 (이미 섹션 있음)
OWNER_NAME="Bob"
if grep -q '^## 프로젝트 오너$' "$CLAUDE_PROJECT_DIR/CLAUDE.md"; then
  echo "⚠️  이미 있음 — append 스킵"
else
  echo "❌ 잘못된 결과: append 됨"
fi
grep -c '## 프로젝트 오너' "$CLAUDE_PROJECT_DIR/CLAUDE.md"
```

Expected:
```
⚠️  이미 있음 — append 스킵
1
```

- [ ] **Step 6: 시나리오 5 — meeting.md 참조 확인**

실제 meeting 커맨드는 Claude Code 세션에서 대화형으로 돈다. 이 단계는 "문서상 참조가 올바른지"만 확인한다.

```bash
grep -n 'Thomas' commands/meeting.md || echo "✓ Thomas 참조 없음"
grep -n '프로젝트 오너' commands/meeting.md
```

Expected:
- `Thomas` 매치 0개 → `✓ Thomas 참조 없음` 출력
- `프로젝트 오너` 매치 최소 2개

- [ ] **Step 7: 샌드박스 정리**

```bash
rm -rf "$SANDBOX"
unset CLAUDE_PROJECT_DIR CLAUDE_PLUGIN_ROOT OWNER_NAME
```

- [ ] **Step 8: 검증 결과 커밋 불필요**

이 Task 는 검증만 수행하므로 커밋할 변경이 없다. 모든 시나리오가 Expected 대로 나왔다면 구현 완료.

실패 시: 해당 Task 로 돌아가 수정 후 재실행.

---

## 완료 기준

1. `grep Thomas commands/meeting.md` 가 매치 0개.
2. `templates/CLAUDE.md` 에 `{NAME}` 플레이스홀더와 `## 프로젝트 오너` 섹션 존재.
3. `commands/init.md` 의 5단계가 대화식 프롬프트와 신규/기존 분기를 포함.
4. `plugin.json`·`marketplace.json` 버전이 `1.0.2` 로 동기화.
5. Task 5 의 5개 시나리오가 모두 Expected 대로 동작.

## 후속 작업 (이 플랜 밖)

- CLAUDE.md 의 프로젝트 플랜 메모(`플랜: ~/.claude/plans/claude-code-sdlc-moonlit-stroustrup.md`) 의 "남은 작업: 로컬 테스트 + GitHub 푸시" 에 본 기능이 포함되도록 업데이트는 별도.
- 실제 `/sdlc:init` 을 Claude Code 세션에서 대화형으로 돌려 UX 확인 — 사용자가 직접 수행.
