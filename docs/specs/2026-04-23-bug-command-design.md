# Design Spec: /sdlc:bug 커맨드

- **작성일**: 2026-04-23
- **상태**: 승인됨
- **관련 커맨드**: `commands/bug.md` (신규)

---

## 1. 목적

비긴급 결함을 빠르게 기록하고 Plan에 연결하는 가벼운 트리아지 도구. `/sdlc:hotfix`가 프로덕션 긴급 대응이라면, `/sdlc:bug`는 일반 버그 신고·분류·추적을 담당한다. Critical 심각도는 hotfix 경로로 즉시 분기한다.

---

## 2. 커맨드 시그니처

```
/sdlc:bug [title]
```

| 인자 | 설명 |
|------|------|
| `title` | 버그 제목 (생략 시 대화로 수집) |

**사용 예시:**
```
/sdlc:bug                              # 제목 대화 수집
/sdlc:bug login-button-not-responding  # 제목 지정
```

---

## 3. 전체 흐름

```
1단계: title 수집
2단계: 심각도 선택 (Critical / High / Medium / Low)
  └─ Critical → /sdlc:hotfix 전환 권고 + 중단
3단계: 재현 단계 + 기대/실제 동작 수집
4단계: 버그 문서 생성 (docs/bugs/)
5단계: Plan 파일에 Story 항목 자동 append
6단계: 완료 요약 출력
```

---

## 4. 단계별 상세

### 1단계: title 수집

- 인자로 제공되면 그대로 사용, 공백은 하이픈으로 치환해 `$SLUG` 생성
- 인자 없으면:
  ```
  버그 제목을 한 줄로 입력해 주세요 (예: login-button-not-responding):
  ```
- 응답을 `$TITLE`로 저장, slug화해 `$SLUG` 생성

### 2단계: 심각도 선택

```
심각도를 선택해 주세요:

  1) Critical — 즉각 대응 필요 (프로덕션 영향)
  2) High     — 오늘 내 처리 권장
  3) Medium   — 다음 스프린트 내 처리
  4) Low      — 여유 시간에 처리

답변 (1-4):
```

응답을 `$SEVERITY`로 저장.

**Critical 분기:**
```
🚨 Critical 버그는 /sdlc:hotfix 로 즉각 대응하세요.

→ /sdlc:hotfix <title>        # 기본 모드
→ /sdlc:hotfix <title> --emergency  # 긴급 모드

일반 버그 기록이 필요하면 심각도를 High 이하로 다시 실행하세요.
```
출력 후 **종료**.

### 3단계: 재현 단계 + 기대/실제 동작 수집

순서대로 한 번에 하나씩 질의:

1. ```
   재현 단계를 입력해 주세요 (번호 목록 또는 자유 형식):
   ```
   → `$REPRO_STEPS`

2. ```
   기대 동작은 무엇인가요?
   ```
   → `$EXPECTED`

3. ```
   실제 동작은 무엇인가요?
   ```
   → `$ACTUAL`

### 4단계: 버그 문서 생성

경로: `${CLAUDE_PROJECT_DIR}/docs/bugs/bug-${SLUG}-${DATE}.md`

`docs/bugs/` 디렉토리가 없으면 생성.

**문서 구조:**
```markdown
# Bug: <TITLE> — <YYYY-MM-DD>

- 심각도: <SEVERITY>
- 상태: Open

## 재현 단계
<REPRO_STEPS>

## 기대 동작
<EXPECTED>

## 실제 동작
<ACTUAL>
```

### 5단계: Plan 파일에 Story append

`scripts/resolve-plan-path.sh`로 현재 feature의 Plan 경로 결정.

Plan 파일이 존재하면 파일 맨 끝에 append:
```markdown

### Bug Story: <TITLE>

- [ ] 재현 확인
- [ ] 원인 분석
- [ ] 수정 구현
- [ ] 테스트 + PR
- 참조: docs/bugs/bug-<SLUG>-<DATE>.md
```

**Plan 없을 때 처리:**
- current feature 미설정: `⚠️ CLAUDE.md에 current feature가 없습니다. 버그 문서만 생성합니다.`
- Plan 파일 미존재: `⚠️ Plan 파일을 찾을 수 없습니다 (<path>). 버그 문서만 생성합니다.`

### 6단계: 완료 요약

```
✓ 버그 기록 완료

- 문서: docs/bugs/bug-<SLUG>-<DATE>.md
- 심각도: <SEVERITY>
- Plan Story 추가: <Plan 파일 경로 또는 "없음">

다음 단계:
- /sdlc:plan 으로 Story 우선순위 조정
- /sdlc:story start 로 수정 시작
```

---

## 5. 산출물

| 파일 | 조건 |
|------|------|
| `docs/bugs/bug-<slug>-<YYYY-MM-DD>.md` | 항상 생성 |
| Plan 파일 (Story append) | Plan 존재 시에만 |

---

## 6. 의존성

| 항목 | 내용 |
|------|------|
| 선행 커맨드 | 없음 (독립 실행) |
| 읽는 파일 | `CLAUDE.md` (current feature), Plan 파일 |
| 쓰는 파일 | `docs/bugs/bug-<slug>-<date>.md`, Plan 파일 |
| 스크립트 | `scripts/resolve-plan-path.sh` |
| 페르소나 | 없음 |

---

## 7. 범위 밖

- 실제 코드 수정 (구현은 사용자)
- 버그 중복 감지
- 버그 상태 추적 (Open → Fixed 등)
- PR 생성 (`/sdlc:pr` 담당)
- 배포 (`/sdlc:release` 또는 `/sdlc:hotfix` 담당)
