# sdlc — Claude Code SDLC Plugin

14 개 슬래시 커맨드와 21 명의 팀 페르소나로 아이디어→릴리스→회고 전체 생명주기를 지원하는 Claude Code 플러그인.

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

## 빠른 시작

```
# 1) 최초 1회: 프로젝트 초기화
/sdlc:init

# 2) Feature 수집 — CLAUDE.md 에 Current Feature 자동 등록
/sdlc:feature checkout-v2

# 3~7) 이름 인자 생략 시 Current Feature 자동 사용
/sdlc:prd
/sdlc:architecture
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

## 커맨드 (14 + 1)

| 커맨드 | 목적 | 빈도 |
|---|---|---|
| `/sdlc:init` | 프로젝트 초기화 (docs 트리, 표준 설치) | 프로젝트당 1회 |
| `/sdlc:feature` | 만들고 싶은 것을 대화로 받아 기능 리스트로 정리 (반~1페이지) | 기능 시작 시 |
| `/sdlc:prd` | feature → 공식 PRD 생성 | 기능 시작 시 |
| `/sdlc:architecture` | PRD → 아키텍처 + 표준 링크 | 기능 시작 시 |
| `/sdlc:plan` | Epic→Story→Task 분해 | 기능 시작 시 |
| `/sdlc:story` | Story 킥오프/검증/완료 | Story마다 3회 |
| `/sdlc:pr` | PR 본문·커밋 메시지 생성 | Story마다 1회 |
| `/sdlc:meeting` | 범용 팀 토론 (feature/prd/architecture 외 토픽) | 주 1-2회 |
| `/sdlc:standup` | 일일 스탠드업 리포트 | 매일 |
| `/sdlc:status` | Plan 진행 상황 집계 | 매일 |
| `/sdlc:scope-change` | 스코프 변경 공식 기록 | 필요 시 |
| `/sdlc:plan-review` | 팀 페르소나 4축 리뷰 | Plan 확정 전 |
| `/sdlc:retrospective` | KPT/4L 회고 | 프로젝트당 1회 |
| `/sdlc:onboard` | 새 팀원 온보딩 | 합류 시 |
| `/sdlc:roles` | 21명 페르소나 목록 | 참조용 |

## 페르소나 (21)

| 분류 | 페르소나 |
|---|---|
| 진행 | 🎩 facilitator · 🧭 scrum-master · 🗓️ planner |
| 기획 | 🔍 analyst · 📋 pm · 🎭 ux |
| 설계 | 🏛️ architect · 🧑‍🏫 techlead |
| 구현 | ⚙️ backend · 🎨 frontend · 📱 mobile |
| 데이터·인프라 | 🗄️ dba · ☁️ cloud · 📊 data · 🤖 ml |
| 운영·품질 | 🔭 sre · 🧪 qa |
| 지원 | 🛡️ security · 📝 writer · ⚖️ legal · 💰 finops |

## 설치되는 문서 구조

`/sdlc:init` 을 실행하면 사용자 프로젝트에 다음이 생성된다. 파일명 규약: **`<type>-<name>.md`**.

```
docs/
├── features/               # feature-<name>.md  (/sdlc:feature 결과)
├── prd/                    # prd-<name>.md      (/sdlc:prd 결과)
├── architecture/           # architecture-<name>.md  (/sdlc:architecture 결과)
├── plans/                  # Plan 문서
│   ├── archive/            # 스코프 변경 시 원본 백업
│   └── scope-changes/      # 변경 상세 리포트
├── meetings/               # /sdlc:meeting 결과
├── retrospectives/         # /sdlc:retrospective 결과
├── standups/               # /sdlc:standup 리포트
├── pr-drafts/              # /sdlc:pr 본문
├── onboarding/             # /sdlc:onboard 문서
├── guides/                 # 개발 가이드
└── standards/              # 25개 스택별 표준
    ├── backend/{springboot,fastapi,nextjs-typescript}/
    ├── frontend/
    └── database/
```

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

## 버전

- **v1.1.0** — `/sdlc:feature`, `/sdlc:prd`, `/sdlc:architecture` 3개 커맨드 추가로 워크플로우 정형화. `docs/features/` 디렉토리 도입. **산출물 파일명 규약 변경**: `docs/<type>/<name>.md` → `docs/<type>/<type>-<name>.md` (breaking — 기존 프로젝트는 rename 필요). **Current Feature 메커니즘**: `/sdlc:feature` 가 CLAUDE.md 에 자동 등록, 후속 커맨드는 이름 인자 생략 시 이를 사용. **샘플 PRD/아키텍처 제거**: 커맨드가 직접 생성하므로 `email-verification` 샘플 파일은 더 이상 설치되지 않는다.
- **v1.0.2** — `/sdlc:init` step 5 에 프로젝트 오너 대화식 프롬프트 추가.
- **v1.0.1** — marketplace.json `source` 스키마 수정 (`"."` → `"./"`).
- **v1.0.0** — 최초 릴리스. 11개 커맨드 + 21개 페르소나 + 25개 표준 + 샘플 PRD/아키텍처.

## 라이선스

MIT
