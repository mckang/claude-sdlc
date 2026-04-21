# 개발 워크플로우 — Story 단위 반자동 사이클

Plan이 준비된 상태에서 실제 코드 작성을 시작하는 가이드.

## 전제 조건

다음이 모두 있어야 한다 (`<feature>` 는 kebab-case 식별자):
- `docs/features/feature-<feature>.md` — 초기 아이디어
- `docs/prd/prd-<feature>.md` — 요구사항
- `docs/architecture/architecture-<feature>.md` — 설계
- `docs/plans/plan-<feature>.md` — Epic/Story/Task 분해 완료
- `docs/plans/plan-<feature>.deps.md` — 의존성 그래프 (선택)
- `docs/standards/` — 팀 표준 문서
- `CLAUDE.md` 의 `## Current Feature` 섹션에 `<feature>` 이름이 등록되어 있음 (`/sdlc:feature` 실행 시 자동)

## 전체 사이클 (한 Story당)

```
┌─ 1. 킥오프 ──┐
│  Story 선택  │
│  맥락 공유   │
│  접근 계획   │
└──────┬──────┘
       ↓
┌─ 2. 설계 확인 ┐
│  파일 구조    │
│  의존성       │
│  표준 체크    │
│  질문 해소    │
└──────┬───────┘
       ↓
┌─ 3. 구현 ────┐
│  Task 순서   │
│  코드 작성   │
│  커밋 단위   │
└──────┬──────┘
       ↓
┌─ 4. 검증 ────┐
│  단위 테스트 │
│  AC 점검     │
│  DoD 체크    │
│  린트·타입   │
└──────┬──────┘
       ↓
┌─ 5. 마무리 ──┐
│  Plan 갱신   │
│  커밋·PR     │
│  완료 보고   │
└──────┬──────┘
       ↓
   다음 Story
```

각 단계에서 사용자가 확인·조정 가능. Story 완료될 때마다 중간 점검.

---

## 1단계: 킥오프

### 세션 시작 시 (프로젝트 첫 세션만)

```bash
cd <프로젝트 루트>
claude
```

Claude에게 프로젝트 맥락 주입:

```
> 이 프로젝트는 CLAUDE.md 의 Current Feature 를 중심으로 다음 문서들을 기반으로 개발됩니다:
> - Feature: docs/features/feature-<feature>.md
> - PRD: docs/prd/prd-<feature>.md
> - 아키텍처: docs/architecture/architecture-<feature>.md
> - Plan: docs/plans/plan-<feature>.md
>
> 참조 표준: docs/standards/ 아래 (스택에 따라 자동 참조)
>
> 먼저 Plan을 읽고 현재 진행 상황을 /sdlc:status 로 파악해주세요.
> 그 다음 다음 작업할 Story를 제안해주세요.
```

### 각 Story 시작 시

```
> /story start <Story ID>
```

또는 수동으로:

```
> 다음 Story(E1-S1)를 시작합니다.
> - Plan에서 E1-S1 섹션을 다시 읽어주세요
> - 관련 아키텍처 섹션도 확인
> - 이 Story의 의존성이 모두 완료됐는지 확인
> - 접근 방법을 3-5줄로 요약해주세요
```

Claude는 다음을 보고해야 한다:
- **이해한 목표**: Story가 뭘 달성하는지
- **수용 기준(AC)**: 무엇이 완료 조건인가
- **작업 순서**: 어떤 Task를 어떤 순서로
- **예상 파일**: 만들거나 수정할 파일 목록
- **질문·불확실성**: 명확하지 않은 부분

사용자는 여기서 승인 or 조정.

---

## 2단계: 설계 확인

Claude가 구현 전에 반드시 다음을 점검:

### 관련 표준 로드

Story의 담당 영역에 따라:
- backend Task → `docs/standards/backend/<스택>/` 읽기
- dba Task → `docs/standards/database/` 읽기
- frontend Task → `docs/standards/frontend/` 읽기

### 기존 코드 탐색

```
> 이 Story 관련 기존 코드를 먼저 파악해주세요:
> - 유사한 기능이 이미 있는지
> - 재사용할 패턴·유틸
> - 수정해야 할 기존 파일
```

Glob/Grep으로 탐색 후 보고.

### 의문 해소

Claude가 "이 부분이 모호하다" 또는 "설계 문서와 불일치"를 발견하면 **구현 시작 전에 질문**. 임의 판단 금지.

사용자는:
- 즉석 결정 가능하면 답변
- 결정이 큰 영향이면 `/meeting` 으로 토론 세션
- PRD·아키텍처 수정 필요하면 먼저 그쪽 보정

### 접근 방법 승인

사용자가 "좋습니다, 진행하세요"라고 해야 구현 시작.

---

## 3단계: 구현

### Task 순서대로

Plan의 Task 순서(의존성 고려)대로 구현.

### 작은 커밋 단위

한 Task가 끝나면 커밋. Story가 끝나면 PR. (팀 규칙에 따라 조정)

### 중간 결정 발생 시

예상 못한 결정 지점이 나오면 **구현 중단**하고 사용자에게 문의:

```
⚠️ E1-S1-T3 구현 중 결정이 필요합니다:
- 이슈: 재전송 쿨다운을 1분 vs 5분
- 영향: 사용자 경험·봇 방어 강도
- 권장: Security·UX 의견 필요

옵션:
(a) 지금 결정해주세요 ([1분/5분])
(b) /meeting 으로 security, ux, pm 불러 토론
```

### 표준 위반 감지

Claude가 구현 중 표준을 벗어나야 할 상황이면 **명시적 예외 기록**:

```
// TODO: docs/standards/backend/springboot/api.md 의 
// "응답 공통 래퍼 금지" 규칙의 예외입니다.
// 이유: 외부 파트너 API 연동 필요로 {code, data} 구조 강제됨.
// 승인: (meeting 파일 링크 or 사용자 결정 참조)
```

---

## 4단계: 검증

### 단위 테스트

Story가 요구하는 테스트 작성 + 실행.

```
> 이 Story에 대한 테스트를 작성하고 실행해주세요.
> docs/standards/backend/<스택>/testing.md 의 규칙 준수.
```

### AC 점검

각 AC를 **하나씩** 테스트 또는 수동 확인:

```
> E1-S1의 AC를 하나씩 검증합시다:
> AC-1: Given ~ When ~ Then ~ → 테스트 또는 실행 결과
> AC-2: ...
```

AC 중 하나라도 실패하면 구현으로 복귀.

### DoD 체크리스트

Story에 정의된 DoD 전체 순회:

```
DoD 점검:
- [x] 단위 테스트 통과
- [x] 린트·타입체크 통과
- [x] 코드 리뷰 준비
- [x] 문서 업데이트
- [ ] 스테이징 배포  ← 아직 안 됨
```

### 표준 체크리스트 (자동)

Claude가 스스로 점검:
- `security.md`의 "금지 사항" 에 해당하는 코드 없는지
- `testing.md`의 "금지 사항" 없는지
- `api.md`의 응답 규격·HTTP 상태 코드 맞는지
- 민감정보 로그 없는지

---

## 5단계: 마무리

### Plan 갱신

Task 체크박스를 `[x]`로 변경:

```
> E1-S1의 모든 Task를 Plan에서 [x]로 업데이트해주세요.
> 그리고 /status --update 로 스냅샷 갱신.
```

### 완료 보고

Claude가 다음 형식으로 마무리:

```
✅ E1-S1 완료

변경된 파일:
- src/main/java/.../UserVerificationService.java (신규)
- src/main/resources/db/migration/V020__create_verification_tokens.sql (신규)
- src/test/java/.../UserVerificationServiceTest.java (신규)

신규 의존성: 없음

설계 대비 차이: 없음

알려진 이슈·후속 작업:
- SES 프로덕션 승인 대기 (E2-S1-T3 블로킹 가능성)

다음 Story: E1-S2 (또는 Plan 순서 따름)
```

### 커밋·PR

팀 규칙에 따라:

```
git add <변경 파일>
git commit -m "feat(verification): E1-S1 토큰 기반 구조 구현

- 인증 토큰 테이블 마이그레이션
- 토큰 생성·검증 서비스
- 단위 테스트 추가"
```

또는 Claude에게 요청:
```
> 이 Story에 맞는 커밋 메시지 작성하고 커밋해주세요.
```

### 다음 Story로

```
> 다음 Story로 넘어갑시다. /story start E1-S2
```

---

## 특수 상황 처리

### 상황 1: Story가 예상보다 크다

**증상**: 구현해보니 Task가 더 많이 필요.

**대응**: 
1. 즉시 구현 중단
2. `/meeting scrum-master, backend | E1-S1 재분해 | docs/meetings/resize-E1-S1.md`
3. Plan 업데이트 (Story를 쪼개거나 Task 추가)

### 상황 2: 아키텍처 결정이 틀렸음을 발견

**증상**: 구현하다가 설계 문서의 결정이 실제로 안 됨.

**대응**:
1. 변경 범위 파악
2. `/meeting architect, backend | 설계 수정: <내용> | docs/meetings/arch-change.md`
3. 아키텍처 문서 갱신
4. 영향받는 다른 Story들 재검토

### 상황 3: 블로킹 발생

**증상**: 외부 의존성·승인 대기로 진행 불가.

**대응**:
1. Task에 `[!]` 표시
2. `/status --update`
3. **병렬 작업 가능한 Story 탐색**:
   ```
   > 지금 막힌 것 외에 병렬로 진행 가능한 Story가 있나요?
   > 의존성 그래프(.deps.md)를 확인해주세요.
   ```
4. 블로킹 해제를 추적하는 별도 Task 생성

### 상황 4: 테스트 실패

**증상**: 작성한 테스트가 돌렸더니 실패.

**대응**: 
- 구현 버그 → 수정 후 재실행
- 테스트 자체 오류 → 테스트 수정
- AC 해석 오류 → 사용자에게 AC 의도 재확인
- **절대 테스트를 느슨하게 만들어 통과시키지 않음** (QA 원칙)

### 상황 5: 중간에 세션이 끊김

**증상**: Claude Code 세션 종료 후 재시작.

**대응**:
1. 새 세션 시작
2. Claude에게:
   ```
   > CLAUDE.md 의 Current Feature 확인 후 다음 문서들을 읽고 현재 상태 파악:
   > - docs/plans/plan-<feature>.md (특히 최근 상태 스냅샷)
   > - docs/prd/prd-<feature>.md
   > - docs/architecture/architecture-<feature>.md
   >
   > 어느 Story까지 완료됐고 다음에 뭘 해야 하는지 알려주세요.
   ```
3. `/sdlc:status` 로 재확인
4. 그 다음 Story 킥오프

---

## 팀·IDE 연동

### Git 브랜치 전략 (제안)

- `main` / `develop` 기본 브랜치
- Story 하나당 브랜치: `feature/<feature-name>-E1-S1`
- Story 완료 시 PR → 리뷰 → merge

### 이슈 트래커 연동

Plan의 Task들을 Jira/Linear/GitHub Issues에 미리 등록:

```
> Plan의 E1 Epic 하위 Story·Task를 GitHub Issue로 만들 수 있는 
> gh cli 명령어를 생성해주세요.
```

또는 MCP 서버가 있으면 자동 동기화.

### PR 설명 자동 생성

```
> 이 Story(E1-S1)에 대한 PR 설명을 작성해주세요:
> - 참조: Plan의 E1-S1 섹션
> - AC 체크리스트 포함
> - 관련 이슈 링크
```

---

## 세션 운영 팁

### 세션당 한 Story 권장

컨텍스트 윈도우 낭비를 막기 위해:
- 세션 시작 시 Plan·아키텍처·표준 로드 (5-10K 토큰)
- 구현 (5-30K 토큰, Story 크기에 따라)
- 검증·테스트 (5-10K)

=> Story 하나 끝나면 세션 닫고 새로 여는 게 깔끔.

### 여러 Story를 한 세션에서 할 때

```
> 이 세션에서 E1-S1, E1-S2, E1-S3를 연속으로 진행하려 합니다.
> 각 Story 완료 시 중간 요약을 주시고, 다음으로 넘어갈 때 
> 이전 컨텍스트에서 필요한 것만 요약해주세요.
```

Claude가 진행 중 자체 컨텍스트 정리를 하게 유도.

### 헤비한 리팩토링은 별도 Story

기존 코드 정리는 본 기능 Story에 섞지 말고 별도 Story로:
- `E1-S0: 기존 Auth 코드 리팩토링` (본 기능 시작 전)

---

## 금지 사항

- **Plan 없이 개발 시작** — 최소한의 Story 분해라도 있어야 함
- **AC 불명확한 Story 구현** — 완료 판단 불가
- **표준 무시** — 예외면 문서화, 무시는 금지
- **테스트 느슨하게** — AC를 테스트가 못 잡으면 테스트를 고쳐야
- **한 번에 여러 Story 병렬** (단일 개발자 기준) — 컨텍스트 혼란
- **블로킹을 방치** — 즉시 `[!]` 표시, 병렬 작업 탐색
- **XL Story 그대로 구현** — 반드시 재분해
- **완료 보고 없이 다음 Story로** — Plan 갱신·문서화 필수
