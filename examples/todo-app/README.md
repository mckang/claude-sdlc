# Todo App — SDLC Plugin Reference Example

> 이 앱은 **완성된 결과물** 보다 **SDLC 방법론을 따라가는 과정의 산출물**이 더 중요합니다. [docs/](docs/) 트리를 먼저 보세요.

`sdlc` Claude Code 플러그인의 전체 워크플로우(`feature → prd → architecture → plan → story × 5 → pr`)를 실제로 돌려서 만든 **레퍼런스 Todo 앱**. 초심자가 이 예제의 문서만 읽어도 각 커맨드가 어떤 산출물을 남기는지 감을 잡을 수 있습니다.

## 기술 스택

- Next.js 14 App Router · React 18 · TypeScript strict
- Tailwind CSS
- 브라우저 localStorage (서버·DB 없음)

## 실행

```bash
cd examples/todo-app
npm install
npm run dev         # http://localhost:3000
```

다른 명령:
```bash
npm run build       # 프로덕션 빌드
npm run typecheck   # TypeScript strict 검증
npm run lint
```

## SDLC 산출물 지도

이 프로젝트의 **학습 가치는 `docs/` 트리**에 있습니다. 플러그인 각 커맨드가 만든 산출물이 그대로 들어있습니다.

| 단계 | 커맨드 (가정) | 산출물 |
|---|---|---|
| 1. 아이디어 수집 | `/sdlc:feature todo-app` | [docs/features/feature-todo-app.md](docs/features/feature-todo-app.md) |
| 2. 공식 PRD | `/sdlc:prd` | [docs/prd/prd-todo-app.md](docs/prd/prd-todo-app.md) |
| 3. 아키텍처 | `/sdlc:architecture` | [docs/architecture/architecture-todo-app.md](docs/architecture/architecture-todo-app.md) |
| 4. Plan | `/sdlc:plan` | [docs/plans/plan-todo-app.md](docs/plans/plan-todo-app.md) + [plan-todo-app.deps.md](docs/plans/plan-todo-app.deps.md) |
| 5. Story 사이클 × 5 | `/sdlc:story start/verify/complete` | [docs/plans/todo-app/](docs/plans/todo-app/) 하위 5개 Story 폴더 |
| 6. CLAUDE.md | `/sdlc:init` | [CLAUDE.md](CLAUDE.md) |

### Story 사이클 완전판: E1-S1

다섯 Story 중 **E1-S1 만 kickoff · verify · complete 3종 보고서를 모두** 보존했습니다. 나머지 Story(E1-S2, E1-S3, E2-S1, E2-S2) 는 `complete.md` 만 보존.

- [E1-S1/kickoff.md](docs/plans/todo-app/E1-S1/kickoff.md) — Story 착수 시 생성. AC·Task·접근 방법·확인 필요 사항
- [E1-S1/verify.md](docs/plans/todo-app/E1-S1/verify.md) — 구현 후 생성. AC/DoD/표준 체크 결과
- [E1-S1/complete.md](docs/plans/todo-app/E1-S1/complete.md) — 완료 시 생성. 변경 파일 목록, 커밋 제안, 다음 Story 제안

실제로 `/sdlc:story verify` 는 `complete` 전에 매번 자동 저장됩니다.

## 소스 구조

```
examples/todo-app/
├── app/                   # Next.js App Router (layout + page)
├── components/            # TodoApp · TodoForm · TodoList · TodoItem · TodoFilter · TodoFooter
├── lib/                   # types · storage (localStorage) · use-todos (hook)
└── docs/                  # ← SDLC 산출물 (여기가 이 예제의 핵심)
```

## 이 예제를 복제해서 내 프로젝트를 시작하려면

1. 빈 디렉토리로 이동 (`mkdir my-app && cd my-app && git init`)
2. `claude --plugin-dir /path/to/sdlc-plugin` (또는 `/plugin install sdlc@sdlc-tools`)
3. Claude Code 안에서 `/sdlc:init` → 스택 선택 · 오너 이름
4. `/sdlc:feature my-feature` → 대화로 아이디어 수집
5. `/sdlc:prd` → `/sdlc:architecture` → `/sdlc:plan`
6. `/sdlc:story start E1-S1` 부터 순차 진행

이 예제의 `docs/` 트리가 **각 단계에서 어떤 내용·깊이**를 기대하는지 그대로 참고용 레퍼런스입니다.

## 알려진 제약

- 서버·동기화 없음 (PRD Out of Scope). 다른 기기·브라우저 간 공유 불가
- 동시 탭 간 실시간 동기화 없음. 한쪽에서 변경 후 다른 쪽 새로고침하면 반영됨
- 자동화 테스트 없음 — 예제 경량화를 위해 Plan 단계에서 명시적으로 제외 (반대 의견은 [plan-todo-app.md](docs/plans/plan-todo-app.md) "반대 의견 보존" 섹션에 기록됨)

## 라이선스

이 예제 코드는 `sdlc-plugin` 저장소와 동일한 MIT 라이선스를 따릅니다.
