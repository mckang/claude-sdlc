---
argument-hint: [feature 이름 (kebab-case)] | --push <이름> | --pop | --list | --drop <이름>
description: feature 아이디어 수집 + Current/Stack 관리 (동시 feature 작업 지원)
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# Feature 아이디어 수집 + 스택 관리 명령

사용자가 `/sdlc:feature [이름|플래그]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/sdlc:feature                         # 이름 없이 대화형 수집 (current 로 등록)
/sdlc:feature html5-tetris            # 이름 지정 + 아이디어 수집
/sdlc:feature --push hotfix-login     # 현재 Current 를 스택 top 으로 push 후 새 feature 수집
/sdlc:feature --pop                   # 스택 top 을 Current 로 복원 (수집 과정 없음)
/sdlc:feature --list                  # Current + Stack 상태 출력
/sdlc:feature --drop old-abc          # 스택에서 제거
```

## 목적

**아이디어를 가볍게 수집**해 `docs/features/feature-<name>.md` 에 기능 리스트로 정리한다.
PRD 수준의 FR/NFR·페르소나·성공지표는 다루지 **않는다** (그건 `/sdlc:prd` 단계).

추가로 이 커맨드는 **Current Feature 의 stack 전환**을 지원한다 — 진행 중인 feature 를 보존한 채 잠깐 다른 feature(핫픽스 등)를 끼워 작업하고 복귀할 수 있다.

이 커맨드는 **대화형**이다 (`--push`/새 이름 경로). `--pop`·`--list`·`--drop` 은 즉시 실행 (상호작용 없음).

## 1단계: 인자 파싱 (모드 분기)

`--list` / `--pop` / `--drop <이름>` 은 아이디어 수집 단계를 전혀 타지 않는 **빠른 경로**. 스택 조작만 하고 종료.

```bash
set -- $ARGUMENTS

case "${1:-}" in
  --list)
    bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" list
    exit 0 ;;
  --pop)
    bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" pop
    exit 0 ;;
  --drop)
    [ -n "${2:-}" ] || { echo "❌ --drop <이름> 이 필요합니다."; exit 1; }
    bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" drop "$2"
    exit 0 ;;
  --push)
    [ -n "${2:-}" ] || { echo "❌ --push <이름> 이 필요합니다."; exit 1; }
    MODE="push"
    NAME="$2" ;;
  --*)
    echo "❌ 알 수 없는 플래그: $1"; exit 1 ;;
  *)
    MODE="set"
    NAME="${1:-}" ;;
esac
```

이름이 주어졌고 kebab-case 가 아니면 한 번만 안내 후 kebab-case 로 교정 제안:
```
이름이 kebab-case 가 아닙니다. "html5-tetris" 같은 형식을 권장합니다.
그대로 쓸까요, 아니면 교정할까요?
```

## 2단계: 페르소나 로드 (가볍게)

`${CLAUDE_PLUGIN_ROOT}/agents/pm.md` 를 `Read` 로 읽어 PM 의 어조·관점만 참고한다.
여기서는 다자간 토론이 아니라 **사용자와 PM 1:1 대화**다.

프로젝트 오너는 `${CLAUDE_PROJECT_DIR}/CLAUDE.md` 의 "프로젝트 오너" 섹션에서 확인
(없으면 현재 사용자). 의사결정은 오너에게 물어본다.

## 3단계: 대화 시작 — 핵심 아이디어

다음 문장 하나만 먼저 던지고 **응답을 기다린다**.

```
**📋 T'Challa (PM):**
무엇을 만들고 싶은지 한두 문장으로 들려주세요.
(예: "HTML5 기반 테트리스 게임", "사내용 회의실 예약 슬랙봇")
```

사용자 응답을 받으면 PM 이 한 줄로 되풀이해 확인:
```
**📋 T'Challa (PM):**
제가 이해한 바는 "HTML5 Canvas 기반 브라우저 테트리스 게임" 입니다. 맞나요?
```

필요하면 한 번 더 맞춤. 맞으면 다음 단계로.

### 이름 미정 시
이 시점에 kebab-case 식별자를 함께 정한다:
```
**📋 T'Challa (PM):**
문서 파일명으로 쓸 짧은 식별자를 제안합니다: `html5-tetris`
괜찮을까요? (다른 이름을 원하면 직접 알려주세요)
```

## 4단계: 기능 자유 입력

```
**📋 T'Challa (PM):**
어떤 기능들을 넣고 싶으세요? 떠오르는 대로 나열해 주세요.
(한 번에 다 떠올릴 필요 없이, 생각나는 만큼 말씀해 주시면
제가 정리하면서 더 물어볼게요.)
```

사용자가 자유롭게 나열하면:
- **한 번에 하나의 bullet 로 정리** (사용자 언어 최대한 보존)
- 모호하면 **한 번만** 명료화 질문 ("'랭킹'은 로컬 저장인가요, 서버 공유인가요?")
- 확실히 다음 단계에서 다룰 항목 (예: "성능 목표") 은 여기서 깊게 안 들어가고 노트만
- 사용자가 "더 있어요" 하면 계속 받기, "이 정도면 충분" 하면 종료

### 중간 요약

대여섯 개쯤 쌓이면 한 번 정리해 보여주고 가지치기 제안:
```
**📋 T'Challa (PM):**
지금까지 정리하면 이런데요:

- 기본 7-tetromino 테트리스 플레이
- 점수 랭킹 (로컬 저장)
- 2인 대전 (같은 화면 분할)
- 블록 스킨 선택
- 모바일 터치 지원

이 중에서 1차 버전에 꼭 들어가야 할 것과, 다음으로 미뤄도 될 것을 나눠볼까요?
```

사용자 응답에 따라 **핵심 기능** / **나중 고려** 로 분리.

### 대화 규칙

- **한 응답에 질문 하나씩**. 여러 개 묶어 묻지 않는다.
- 사용자가 답 못 하거나 헷갈려하면 **가짜 추정 금지** — "결정 필요" 로 남김.
- 사용자가 "충분하다" 하면 즉시 4단계 종료.
- 전체 대화 시간 목표: **5분 이내**. 길어지면 PM 이 "나머지는 PRD 단계에서 다루죠" 하고 종료 유도.

## 5단계: 산출물 작성

수집한 내용을 아래 **가벼운** 템플릿으로 `Write`:

```markdown
# Feature: {한 줄 요약}

- **식별자**: <name>
- **작성일**: YYYY-MM-DD
- **작성자**: {오너 또는 현재 사용자}
- **상태**: draft

## 개요
{사용자가 말한 핵심 아이디어, 1-3문장}

## 기능

### 핵심 (1차)
- {기능 1}
- {기능 2}
- ...

### 나중 고려
- {미뤘거나 "있으면 좋겠다" 한 것}

## 결정 필요
- [ ] {사용자가 답 못 했거나 오너 결정이 필요한 항목}

## 다음 단계
- [ ] 공식 PRD 로 발전: `/sdlc:prd <name>`
```

**분량 제한**: 렌더링 기준 **반 페이지 ~ 1페이지 이내**. 넘치면 PM 이 자체 압축.

### 저장 경로 (명명 규약)

```
${CLAUDE_PROJECT_DIR}/docs/features/feature-<name>.md
```

모든 SDLC 산출물은 `docs/<type>/<type>-<name>.md` 규약을 따른다 — 파일명만 봐도
타입이 즉시 식별되도록 하기 위함.

- 상위 디렉터리 없으면 `mkdir -p`
- 같은 이름의 파일이 이미 있으면:
  ```
  docs/features/feature-<name>.md 가 이미 존재합니다.
    1) 덮어쓰기 (기존은 feature-<name>-history.md 로 백업)
    2) 편집 모드 (기존 내용 기반으로 보강)
    3) 취소
  ```

## 6단계: CLAUDE.md 에 Current Feature 등록

`/sdlc:feature` 는 이 feature 를 **현재 작업 중인 feature** 로 CLAUDE.md 에 기록한다.
후속 커맨드(`/sdlc:prd`, `/sdlc:architecture`, `/sdlc:plan`, `/sdlc:story` 등)가
이름 인자를 생략하면 이 값을 기본값으로 resolve 한다.

모드 분기:
- `MODE=set` (기본) → 기존 Current 를 그냥 교체 (스택 무변경)
- `MODE=push` → 기존 Current 를 스택 top 으로 밀어 넣고 새 Current 설정

두 경로 모두 `scripts/feature-stack.sh` 에 위임:

```bash
if [ "$MODE" = "push" ]; then
  bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" push "$NAME"
else
  bash "${CLAUDE_PLUGIN_ROOT}/scripts/feature-stack.sh" set "$NAME"
fi
```

사용자가 다른 feature 로 전환하고 싶으면:
- **보존하지 않고 교체**: `/sdlc:feature <다른이름>`
- **잠시 다녀오기 (복귀 예정)**: `/sdlc:feature --push <핫픽스>` → 작업 후 `/sdlc:feature --pop`

## 7단계: 최종 보고

```
✅ Feature 아이디어 정리 완료

- 제목: {한 줄 요약}
- 식별자: <name>
- 핵심 기능 N개 / 나중 고려 M개 / 결정 필요 K개
- 산출물: docs/features/feature-<name>.md
- Current Feature: <name> (CLAUDE.md 갱신됨)

다음 단계:
  /sdlc:prd              — 공식 PRD (이름 생략 시 current feature 사용)
  /sdlc:prd <다른이름>    — 다른 feature 지정
```

## 예시 대화 (HTML5 테트리스)

```
사용자: /sdlc:feature

📋 T'Challa: 무엇을 만들고 싶은지 한두 문장으로 들려주세요.

사용자: HTML5 Canvas 로 돌아가는 테트리스를 만들고 싶어. 혼자도 하고
       친구랑 같은 화면에서 대전도 하고 싶어.

📋 T'Challa: "HTML5 Canvas 기반 브라우저 테트리스 + 로컬 2인 대전" 으로 이해했습니다.
       맞나요? 식별자는 `html5-tetris` 어떠세요?

사용자: 좋아.

📋 T'Challa: 어떤 기능들을 넣고 싶으세요? 떠오르는 대로요.

사용자: 기본 테트리스 조작, 점수, 랭킹, 2인 대전, 나중엔 모바일도.

📋 T'Challa: 랭킹은 로컬 저장인가요, 서버 공유인가요?

사용자: 일단은 로컬.

📋 T'Challa: 정리해 보면 —
  - 기본 7-tetromino 플레이
  - 점수 표시 + 로컬 랭킹
  - 2인 대전 (같은 화면)
  - 모바일 터치 (나중)

  1차 출시엔 위 네 개 중 앞 세 개, 모바일은 "나중 고려" 로 두면 될까요?

사용자: 응 그렇게.

📋 T'Challa: ✅ 정리 완료. docs/features/feature-html5-tetris.md 에 저장했고,
       CLAUDE.md 의 Current Feature 도 `html5-tetris` 로 맞춰뒀습니다.
       다음 단계로 그냥 /sdlc:prd 만 돌리시면 이 feature 를 이어받아
       FR/NFR·성공지표까지 구체화됩니다.
```

## 주의사항

- **무겁게 만들지 마라**. 성공지표·페르소나·유스케이스·NFR 은 여기서 다루지 않는다 (PRD 영역).
- 사용자가 답 못 한 질문은 추정하지 말고 "결정 필요" 로 남긴다.
- 산출물 최상단 "식별자" 는 후속 `/sdlc:prd` 가 resolve 하므로 정확해야 한다.
- 기존 파일 갱신 시 반드시 `<name>-history.md` 로 백업.
- 대화를 계속 끌지 마라 — 5분 내, 산출물 반 페이지 내 가 기본 감각.
