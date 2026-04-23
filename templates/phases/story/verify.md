# Story verify — 검증

> **입력 가정**: dispatcher 가 `$STORY_ID`, `$NAME`, `$PLAN` 을 resolve 해 두었다.

구현이 어느 정도 끝난 뒤 호출. AC·DoD·테스트를 체계적으로 점검.

## 1. 브랜치 컨텍스트 확인

```bash
git branch --show-current
```

- **현재 브랜치가 `story/<StoryID>-...` 패턴이 아님** → 경고 1줄 남기고 계속 진행 (초창기 Story 또는 예외 케이스 가능):
  ```
  ⚠️ 현재 브랜치 `main` — Story 브랜치 규칙 위반 가능. verify 는 계속 진행하되 complete 단계에서 브랜치 전략 확인 필요.
  ```
- **다른 Story 의 브랜치에 있음** (`story/E1-S2-...` 인데 `/story verify E1-S1` 호출) → 중단하고 ID 불일치 알림

## 2. 테스트 실행

`Bash`로 해당 Story의 테스트를 실행. 프로젝트 스택에 따라:

- Spring Boot: `./gradlew test --tests "*<키워드>*"`
- Next.js: `pnpm test <패턴>`
- FastAPI: `pytest tests/<경로>`

테스트 실패 시 결과 분석해서 원인 분류:
- 구현 버그
- 테스트 자체 오류
- AC 해석 차이

## 3. AC 검증

각 AC를 하나씩 점검:

```markdown
## AC 검증

### AC-1: 정상 로그인 플로우
- Given 등록된 이메일/비밀번호 → When 로그인 → Then 세션 발급
- ✅ 테스트 `AuthServiceTest#shouldIssueSessionOnValidCredentials` 통과
- 확인됨

### AC-2: 잘못된 비밀번호
- ...
- ❌ 테스트 없음 — 작성 필요

### AC-3: Rate limit
- ...
- 🟡 테스트는 있으나 실제 Redis 환경에서 미검증
```

## 4. DoD 점검

Story의 DoD 체크리스트를 순회:

```markdown
## DoD 점검

- [x] 단위 테스트 통과 — 12/12
- [x] 린트 통과 (`./gradlew check`)
- [ ] 통합 테스트 통과 — 1 실패 (Testcontainers 시작 실패)
- [x] 코드 리뷰 준비 완료
- [ ] 스테이징 배포 — 아직
- [x] 문서 업데이트 (README, API docs)
- [ ] 성능 기준 충족 — 측정 안 함 (NFR 인증 p95 500ms)
```

## 5. 표준 체크리스트 (자동)

관련 표준의 "금지 사항" 섹션을 기준으로 코드 점검:

- `security.md`:
  - 비밀번호 평문 저장? 로그 노출?
  - SQL 인젝션 방어?
  - 민감정보 URL 노출?
- `api.md`:
  - HTTP 상태 코드 규칙?
  - 에러 응답 포맷(ProblemDetail)?
  - `@Valid` 누락?
- `testing.md`:
  - `Thread.sleep()` 있나?
  - H2 사용 (금지)?

Grep으로 탐지 후 보고.

## 6. 검증 요약 보고

보고서 형식은 `${CLAUDE_PLUGIN_ROOT}/templates/reports/story/verify.md` 에 정의돼 있다. `Read` 해서 템플릿으로 쓰고, 2~5 결과로 채워 사용자에게 출력한다.

판정 고정 규칙:
- ✅ PASS: 모든 AC 확인 + DoD 완전 충족 + 표준 위반 0 건.
- 🟡 CONDITIONAL PASS: 핵심 AC 는 통과했지만 일부 DoD 미완 또는 경미한 표준 경고.
- ❌ FAIL: AC 중 하나 이상 불통 또는 표준 위반 🔴 심각.

다음 단계(7) 의 `verify.md` 저장 시 이 판정 라인을 프런트매터 아래 본문 최상단에 유지한다 — 후속 `complete` 단계가 이를 읽어 강제 진행 여부를 판단한다.

## 7. verify.md 저장 (조용한 덮어쓰기)

보고서 출력 직후 `${CLAUDE_PROJECT_DIR}/docs/plans/$NAME/$STORY_ID/verify.md` 로 저장한다. 확인 프롬프트 없음 — verify 는 재실행이 정상 워크플로.

```bash
FEATURE_DIR="${CLAUDE_PROJECT_DIR}/docs/plans/$NAME/$STORY_ID"
mkdir -p "$FEATURE_DIR"

SAVED_AT=$(date +%Y-%m-%dT%H:%M:%S%z)
BRANCH_NAME=$(git branch --show-current 2>/dev/null || echo "(unknown)")
PLAN_REL="${PLAN#${CLAUDE_PROJECT_DIR}/}"
```

`Write` 로 `$FEATURE_DIR/verify.md` 생성 (기존 파일 덮어쓰기):

```markdown
---
story_id: <STORY_ID>
story_title: <Story 제목>
feature: <NAME>
plan: <PLAN_REL>
stage: verify
saved_at: <SAVED_AT>
branch: <BRANCH_NAME>
---
<사용자에게 출력한 검증 요약 보고서 Markdown 본문 그대로>
```

보고서 말미에 1줄 추가:
```
📝 verify.md 갱신됨 (docs/plans/<NAME>/<STORY_ID>/verify.md)
```

`Write` 실패 시 경고 1줄 후 계속.
