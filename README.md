# sdlc — Claude Code SDLC Plugin

Core 7 개 + Extension 11 개 슬래시 커맨드와 13 명의 팀 페르소나로 아이디어→릴리스→회고 전체 생명주기를 지원하는 Claude Code 플러그인.

## 설치

### 팀 내부 GitHub 배포 (권장)

```bash
# Claude Code 세션 안에서
/plugin marketplace add mckang/claude-sdlc
/plugin install sdlc@sdlc-tools
```

또는 팀 공통 `.claude/settings.json` 에 다음을 추가해 팀원 모두 자동 활성화:

```json
{
  "extraKnownMarketplaces": {
    "sdlc-tools": {
      "source": { "source": "github", "repo": "mckang/claude-sdlc" }
    }
  },
  "enabledPlugins": {
    "sdlc@sdlc-tools": true
  }
}
```

### 로컬 개발 모드

```bash
claude --plugin-dir /path/to/sdlc-plugin
```

## 워크플로우 개요

```mermaid
flowchart TD
    init[/sdlc:init] --> entry{시작 지점}
    entry -->|🆕 새 기능| feature[/sdlc:feature]
    entry -->|👋 기존 코드 합류| onboard[/sdlc:onboard]
    entry -->|🐛 버그 수정| bug[/sdlc:bug · /sdlc:hotfix]

    feature --> prd[/sdlc:prd] --> arch[/sdlc:architecture]
    arch --> plan[/sdlc:plan]
    arch -.설계 보강 선택.-> design[/sdlc:design] --> plan

    plan --> story[/sdlc:story<br/>start · verify · complete]
    story --> pr[/sdlc:pr]
    pr -.릴리스 시.-> release[/sdlc:release]

    bug -.Plan Story 연결.-> plan
    onboard -.첫 Story 제안.-> story

    classDef core fill:#e3f2fd,stroke:#1976d2,color:#000
    classDef ext fill:#fff3e0,stroke:#f57c00,color:#000
    class init,feature,prd,arch,plan,story,pr core
    class onboard,bug,design,release ext
```

파란색은 **Core(7)** — 아이디어→릴리스 최소 경로. 주황색은 **Extension** — 필요한 것만 선택.

## 빠른 시작

```
# 1) 최초 1회: 프로젝트 초기화
/sdlc:init

# 2) Feature 수집 — CLAUDE.md 에 Current Feature 자동 등록
/sdlc:feature checkout-v2

# 3~7) 이름 인자 생략 시 Current Feature 자동 사용
/sdlc:prd
/sdlc:architecture
# 선택: 필요한 트랙만. 생략해도 plan 진행 가능
/sdlc:design --api --ui --mockup
/sdlc:plan
/sdlc:story start E1-S1
# ... 구현 ...
/sdlc:story verify E1-S1
/sdlc:story complete E1-S1
/sdlc:pr E1-S1

# 다른 feature 로 전환하려면 /sdlc:feature <다른이름> 재호출
```

산출물 파일명 규약: `docs/<type>/<type>-<name>.md`
(예: `docs/plans/plan-checkout-v2.md`, `docs/prd/prd-checkout-v2.md`)

## 커맨드

커맨드는 **Core** 와 **Extension** 두 갈래로 나뉜다. Core 7 개만 사용해도 아이디어→릴리스 전체 루프가 돈다. Extension 은 필요한 것만 선택적으로 곁들이는 부가 기능이다.

### Core (7) — 아이디어→릴리스 최소 경로

필수. 이 순서가 곧 워크플로우다.

| 커맨드 | 목적 | 빈도 |
|---|---|---|
| `/sdlc:init` | 프로젝트 초기화 (docs 트리, 표준 설치) | 프로젝트당 1회 |
| `/sdlc:feature` | 만들고 싶은 것을 대화로 받아 기능 리스트로 정리 (반~1페이지) | 기능 시작 시 |
| `/sdlc:prd` | feature → 공식 PRD 생성 | 기능 시작 시 |
| `/sdlc:architecture` | PRD → 아키텍처 + 표준 링크 | 기능 시작 시 |
| `/sdlc:plan` | Epic→Story→Task 분해 | 기능 시작 시 |
| `/sdlc:story` | Story 킥오프/검증/완료 | Story마다 3회 |
| `/sdlc:pr` | PR 본문·커밋 메시지 생성 | Story마다 1회 |

### Extension (11) — 선택·부가

필요한 것만 골라 쓴다. 하나도 안 써도 Core 워크플로우는 정상 동작.

**설계 보강**
| 커맨드 | 목적 | 빈도 |
|---|---|---|
| `/sdlc:design` | API · UI 디자인 시스템 · Mockup 중 선택 트랙 설계 | 필요 시 |
| `/sdlc:plan-review` | 팀 페르소나 4축 리뷰 | Plan 확정 전 |
| `/sdlc:scope-change` | 스코프 변경 공식 기록 | 필요 시 |

**자동화 (power user)**
| 커맨드 | 목적 | 빈도 |
|---|---|---|
| `/sdlc:auto-story` | `/sdlc:story` 의 start·verify·complete·로컬 머지를 자동 실행 (wrapper) | Story마다 0~1회 |
| `/sdlc:auto-epic` | Epic 의 Story 들을 의존성 레벨별 병렬 실행 + 순차 fan-in (worktree 기반) | Epic마다 0~1회 |

> ⚠️ **자동화 커맨드는 `/sdlc:story` · `/sdlc:plan` 에 익숙해진 뒤 쓰는 것을 권장**한다. 첫 feature·AC 모호·크리티컬 변경 상황에서는 수동 단계별 실행이 안전하다. 각 커맨드 파일 상단의 "언제 쓸까" 표를 참고.

**보고·운영**
| 커맨드 | 목적 | 빈도 |
|---|---|---|
| `/sdlc:standup` | 일일 스탠드업 리포트 | 매일 |
| `/sdlc:status` | Plan 진행 상황 집계 | 매일 |
| `/sdlc:retrospective` | KPT/4L 회고 | 프로젝트당 1회 |
| `/sdlc:onboard` | 새 팀원 온보딩 | 합류 시 |

**범용·참조**
| 커맨드 | 목적 | 빈도 |
|---|---|---|
| `/sdlc:meeting` | 범용 팀 토론 (feature/prd/architecture 외 토픽) | 주 1-2회 |
| `/sdlc:roles` | 13명 페르소나 목록 | 참조용 |

## 페르소나 (13)

각 페르소나는 frontmatter 의 `tier: essential | specialized` 로 분류된다. 자동 참석자 선정 로직은 essential 을 기본 고려하고, 주제에 따라 specialized 를 합류시킨다. `/sdlc:roles` 는 두 tier 를 분리해 보여준다.

### ⭐ Essential (8) — 거의 모든 미팅의 단골 참석자

| 분류 | 페르소나 |
|---|---|
| 진행 | 🎩 facilitator (Nick) · 🧭 scrum-master (Steve) · 🗓️ planner (Natasha) |
| 기획·설계 | 📋 pm (T'Challa) · 🏛️ architect (Tony) |
| 구현 | ⚙️ backend (Bruce) · 🎨 frontend (Peter) |
| 품질 | 🧪 qa (Clint) |

### 🧩 Specialized (5) — 주제가 닿을 때만 호출

| 키워드 | 페르소나 | 전문 |
|---|---|---|
| techlead | 🧑‍🏫 techlead (Rhodes) | 기술 부채·팀 역량·모바일 플랫폼 |
| data | 🗄️ data (Vision) | OLTP 스키마·파이프라인·ML (dba+data+ml 통합) |
| compliance | 🛡️ compliance (Strange) | AppSec·OWASP·GDPR·라이선스 (security+legal 통합) |
| platform | ⚡ platform (Thor) | 클라우드 인프라·SRE·FinOps (cloud+sre+finops 통합) |
| discovery | 🔍 discovery (Wanda) | 요구사항 분석·UX·기술 문서 (analyst+ux+writer 통합) |

## 설치되는 문서 구조

`/sdlc:init` 을 실행하면 사용자 프로젝트에 다음이 생성된다. 파일명 규약: **`<type>-<name>.md`**.

```
docs/
├── features/               # feature-<name>.md  (/sdlc:feature 결과)
├── prd/                    # prd-<name>.md      (/sdlc:prd 결과)
├── architecture/           # architecture-<name>.md  (/sdlc:architecture 결과)
├── design/                 # <name>/{api,ui,mockup,README}.md  (/sdlc:design 결과, 선택)
├── plans/                  # Plan 문서
│   ├── archive/            # 스코프 변경 시 원본 백업
│   └── scope-changes/      # 변경 상세 리포트
├── meetings/               # /sdlc:meeting 결과
├── retrospectives/         # /sdlc:retrospective 결과
├── standups/               # /sdlc:standup 리포트
├── pr-drafts/              # /sdlc:pr 본문
├── onboarding/             # /sdlc:onboard 문서
├── guides/                 # 개발 가이드
└── standards/              # 선택 설치한 스택별 표준 (v1.5.3+)
    ├── backend/{springboot,fastapi,nextjs-typescript}/   # 선택한 것만
    ├── frontend/                                          # 선택 시만
    └── database/                                          # 선택 시만
```

`/sdlc:init` 은 **어떤 스택을 쓰는지 묻고 선택한 스택만 복사**한다 (v1.5.3 부터). 나중에 스택이 늘면 `/sdlc:init` 을 다시 실행하면 빠진 것만 채워진다 (`cp -Rn` — 기존 파일은 안 건드림).

`CLAUDE.md` 는 기존 파일이 없으면 자동 생성, 있으면 병합 안내만 한다.

## 환경 요구사항

- **필수**: Claude Code (슬래시 커맨드 지원)
- **선택**: `gh` CLI — 없으면 `/sdlc:pr` 은 본문만 생성 (수동 push)
- **선택**: git repo — `/sdlc:standup`, `/sdlc:pr` 의 git 연동 기능에 필요

## 트러블슈팅

| 증상 | 원인 | 해결 |
|---|---|---|
| `docs/ 없음` 에러 | `/sdlc:init` 미실행 | `/sdlc:init` 먼저 실행 |
| 페르소나 찾지 못함 | 플러그인 로드 실패 | `/plugin list` 로 활성화 확인 |
| `/sdlc:pr` 이 PR 생성 안 함 | `gh` CLI 미설치 | `brew install gh && gh auth login` |
| CLAUDE.md 충돌 | 기존 파일 존재 | `${CLAUDE_PLUGIN_ROOT}/templates/CLAUDE.md` 참고해 수동 병합 |

## 📚 예제

이 플러그인의 전체 워크플로우(`feature → prd → architecture → plan → story × N → pr`)를 실제로 돌려 만든 레퍼런스가 있습니다. 초심자는 여기부터 보세요.

- **[examples/todo-app/](examples/todo-app/)** — Next.js 14 App Router + localStorage 기반 Todo 앱. Epic 2개, Story 5개, 각 단계 산출물(feature·PRD·architecture·Plan·Story 보고서) 전부 보존.

## 버전

- **v1.6.2** — 두 가지 변경: (1) Epic/Story/Task 크기 기준 재조정 — `commands/plan.md` Round 1-3 과 `agents/scrum-master.md` 의 단위 기준이 과도하게 작아 상위·하위 단위가 겹치던 문제를 수정. Epic 은 2-4주 다수 스프린트, Task 는 4시간-1일 PR 단위로 명확히 분리. (2) 레퍼런스 예제 추가 — `examples/todo-app/` — Next.js 14 App Router + TypeScript + Tailwind + localStorage 로 구성한 Todo 웹앱. 이 플러그인의 전체 SDLC 방법론(`feature → prd → architecture → plan → story × 5 → pr`)을 **실제로 따라가 만든** 완성된 산출물. `docs/features/`, `docs/prd/`, `docs/architecture/`, `docs/plans/plan-todo-app.md` + `.deps.md`, `docs/plans/todo-app/E*-S*/{kickoff,verify,complete}.md` 전부 포함. 초심자가 각 커맨드가 어떤 산출물을 남기는지 감 잡는 용도.
- **v1.6.1** — 초심자 진입점 개선 + 페르소나 이름 정합화: (1) README 상단에 mermaid 워크플로 다이어그램 추가 — Core/Extension 색상 구분, 3가지 시작 지점(새 기능·기존 코드 합류·버그 수정) 시각화. (2) `/sdlc:init` 완료 안내의 "다음 단계" 섹션을 Greenfield 일변 안내에서 3-choice 분기로 재구성 — 🆕 `/sdlc:feature` · 👋 `/sdlc:onboard` · 🐛 `/sdlc:bug|hotfix` 중 상황에 맞게 선택. (3) 페르소나 이름 정합성 수정 — README/roles skill/feature·meeting·scope-change 커맨드·일부 agent 설명에 남아 있던 옛 이름(Sam·Dana·Noor·Morgan·Alex·Sean·Pat·John)을 실제 `display_name`(Rhodes·Vision·Strange·Thor·Wanda·Nick·T'Challa)로 일괄 교정. 커맨드·페르소나 추가 없음 (문서·UX 만).
- **v1.6.0** — 대규모 리팩토링 5종: (1) PreToolUse 훅 추가 — main/master 직접 커밋 차단 + `docs/standards/` 무단 수정 경고. (2) 21개 페르소나 → 13개로 통합 — analyst+ux+writer→discovery, dba+data+ml→data, security+legal→compliance, cloud+sre+finops→platform, mobile 모자를 techlead 에 흡수; 각 페르소나는 멀티-햇 구조로 도메인 전문성 보존. (3) story.md 528줄 → dispatcher(103줄) + 3개 phase 파일(start/verify/complete)로 분리. (4) resolve-plan-path.sh 공통 스크립트 추출 — 13개 커맨드 중복 로직 제거. (5) Feature Stack 지원 — `--push`/`--pop`/`--list`/`--drop` 으로 동시 멀티-feature 작업 가능 (`## Feature Stack` in CLAUDE.md).
- **v1.5.7** — `CLAUDE.md` 의 `## Current Feature` 섹션 포맷을 YAML 스타일로 변경 (`- **이름**: X` → `- name: X`, `- **최종 갱신**: X` → `- updated: X`). 볼드/한국어 라벨 의존 제거로 사용자가 마크다운 포맷 건드려도 깨지지 않음. `scripts/resolve-current-feature.sh` 는 신·구 두 형식 모두 파싱 (backward compat). 기존 프로젝트는 그대로 동작하며, 다음 `/sdlc:feature` 호출 시 신 형식으로 자동 전환.
- **v1.5.6** — `/sdlc:auto-story` · `/sdlc:auto-epic` 상단에 "⚠️ Power-user" 배너와 "언제 쓸까 / 언제 쓰지 말까" 결정 표 추가. README 의 자동화 섹션에도 주의문 삽입. 동작 변화 없음 — 문서만.
- **v1.5.5** — 보고서 템플릿 외부화: `story.md` 의 kickoff/verify/complete 3 템플릿과 `plan.md` 의 Plan·deps 2 템플릿을 `${CLAUDE_PLUGIN_ROOT}/templates/reports/{story,plan}/*.md` 로 분리. 커맨드 파일은 "이 템플릿을 Read 해서 쓰라" + "핵심 준수 사항" 만 짧게 기술. story.md 652 → 528 줄 (-124), plan.md 413 → 296 줄 (-117). 동작 변화 없음.
- **v1.5.4** — 21 명 페르소나에 `tier: essential | specialized` frontmatter 추가 (essential 8, specialized 13). `/sdlc:roles` 는 두 tier 를 분리해 출력, README 도 두 표로 재편. 파일 이동 없음 — 자동 참석자 선정 로직은 essential 기본 + 주제 매칭 시 specialized 합류.
- **v1.5.3** — `/sdlc:init` 표준 문서 설치가 **on-demand** 로 전환. 이전에는 25 개 표준을 일괄 복사했으나, 이제 사용자가 쓰는 스택(springboot · nextjs · fastapi · frontend · database)만 선택 설치. 나중에 스택이 늘면 `/sdlc:init` 재실행으로 추가(`cp -Rn` — 기존 파일 보존). 기본값(빈 답변)은 `all` 로 이전 동작과 호환.
- **v1.5.2** — README 커맨드 표를 **Core (7) / Extension (11)** 구조로 재편. 설계 보강·자동화·보고·운영·범용 소분류 추가. `plugin.json` · `marketplace.json` description 에도 Core/Extension 표기 반영. 커맨드·페르소나 추가 없음 (문서만).
- **v1.5.1** — 11 개 커맨드에 중복되던 `## Current Feature` 파싱 `awk` 블록을 `scripts/resolve-current-feature.sh` 로 분리. 동작 변화 없음 (패턴·출력 동일). 커맨드 총 줄수 -40.
- **v1.3.0** — `/sdlc:design` 커맨드 추가 (architecture 와 plan 사이의 선택 단계). `--api` · `--ui` · `--mockup` 플래그(또는 `--all`, 또는 대화형 메뉴)로 트랙 선택. 산출물은 `docs/design/<name>/{api,ui,mockup,README}.md` 디렉터리 레이아웃. `/sdlc:plan` 은 design 디렉터리가 있으면 자동 참조하고, 없으면 기존 동작 그대로 유지. 신규 페르소나 없음(기존 21명 활용).
- **v1.2.0** — `/sdlc:story` 각 단계(`start`·`verify`·`complete`) 보고서가 `docs/plans/<feature>/<Story-ID>/{kickoff,verify,complete}.md` 로 자동 저장된다. YAML frontmatter(`story_id`, `feature`, `stage`, `saved_at`, `branch`) + 기존 대화 출력 Markdown 본문 포맷. `start`·`complete` 재실행 시 덮어쓰기 확인, `verify` 는 조용히 덮어쓰기. 저장 실패는 핵심 워크플로(브랜치 생성·Plan 갱신)를 막지 않는다.
- **v1.1.0** — `/sdlc:feature`, `/sdlc:prd`, `/sdlc:architecture` 3개 커맨드 추가로 워크플로우 정형화. `docs/features/` 디렉토리 도입. **산출물 파일명 규약 변경**: `docs/<type>/<name>.md` → `docs/<type>/<type>-<name>.md` (breaking — 기존 프로젝트는 rename 필요). **Current Feature 메커니즘**: `/sdlc:feature` 가 CLAUDE.md 에 자동 등록, 후속 커맨드는 이름 인자 생략 시 이를 사용. **샘플 PRD/아키텍처 제거**: 커맨드가 직접 생성하므로 `email-verification` 샘플 파일은 더 이상 설치되지 않는다.
- **v1.0.2** — `/sdlc:init` step 5 에 프로젝트 오너 대화식 프롬프트 추가.
- **v1.0.1** — marketplace.json `source` 스키마 수정 (`"."` → `"./"`).
- **v1.0.0** — 최초 릴리스. 11개 커맨드 + 21개 페르소나 + 25개 표준 + 샘플 PRD/아키텍처.

## 라이선스

MIT
