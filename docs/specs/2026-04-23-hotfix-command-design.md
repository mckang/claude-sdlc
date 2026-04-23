# Design Spec: /sdlc:hotfix 커맨드

- **작성일**: 2026-04-23
- **상태**: 승인됨
- **관련 커맨드**: `commands/hotfix.md` (신규)

---

## 1. 목적

프로덕션 긴급 장애 또는 당일 처리 필요 패치를 빠르게 안내한다. `/sdlc:release`가 계획된 배포를 다룬다면, `/sdlc:hotfix`는 **계획 외 긴급 수정**을 전담한다. 두 모드로 속도와 안전성 중 하나를 선택한다.

---

## 2. 커맨드 시그니처

```
/sdlc:hotfix [description] [--emergency] [--dry-run]
```

| 인자 | 설명 |
|------|------|
| `description` | hotfix 설명 (예: `login-timeout-fix`), 생략 시 대화로 수집 |
| `--emergency` | 즉각 대응 모드 — Claude가 브랜치 직접 생성, 스테이징 생략 가능 |
| `--dry-run` | 실제 확인 없이 문서 구조만 생성 |

**사용 예시:**
```
/sdlc:hotfix                                  # 기본 모드, description 대화 수집
/sdlc:hotfix login-timeout-fix                # 기본 모드, description 지정
/sdlc:hotfix login-timeout-fix --emergency    # 긴급 모드
/sdlc:hotfix login-timeout-fix --dry-run      # 문서 구조만 생성
```

---

## 3. 전체 흐름

### 기본 모드 (standard)

```
Phase 1: 문제 정의     →    Phase 2: 구현 & PR     →    Phase 3: 배포 & 문서화
(브랜치 명령 안내)           (스테이징 + 1인 리뷰 필수)    (릴리스 노트 + 사후분석)
```

### 긴급 모드 (--emergency)

```
Phase 1: 문제 정의     →    Phase 2: 브랜치 생성     →    Phase 3: 구현 & PR     →    Phase 4: 배포 & 문서화
(영향 범위 + Thor 체크)      (Claude가 직접 실행)           (스테이징 선택, 1인 리뷰 필수)
```

**중단 규칙:**
- 기본 모드: Phase 2 체크리스트 미완료 시 중단 후 재시도 안내
- 긴급 모드: Thor NO-GO → 롤백 먼저 제안 후 중단. Phase 3 리뷰 미완료 시 중단.

---

## 4. CLAUDE.md current feature 처리

hotfix 시작 시:
- CLAUDE.md의 current feature 값을 읽어 `$SAVED_FEATURE`로 보관
- current feature를 `hotfix/<description>`으로 업데이트

hotfix 완료 시:
- current feature를 `$SAVED_FEATURE`로 원복

---

## 5. 기본 모드 상세

### Phase 1: 문제 정의

**description 수집:**
- 인자로 제공되지 않으면: "어떤 문제가 발생했나요? 한 줄로 설명해 주세요 (예: login-timeout-fix):"
- 설명 문자열을 `$DESCRIPTION` 변수에 저장 (공백 → 하이픈 치환)

**영향 범위 질의 (기록용):**
```
영향받는 사용자/기능은 무엇인가요? (간단히):
```
응답을 `$IMPACT`에 저장.

**브랜치 명령어 안내 (사용자가 직접 실행):**
```bash
git checkout main && git pull origin main
git checkout -b hotfix/<description>
```

### Phase 2: 구현 & PR 체크리스트

사용자에게 출력하고 응답을 기다린다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔧 Hotfix 구현 & PR 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] 1. hotfix 브랜치에서 수정 완료
[ ] 2. 로컬 테스트 통과
[ ] 3. 스테이징에서 검증 완료
[ ] 4. PR 생성 후 최소 1인 리뷰 & 승인 받음
[ ] 5. PR이 main에 머지됨
```

**응답 처리:**
- 전부 확인 → Phase 3 진행
- 미완료 항목 있음 → 해당 항목 명시 후 중단, 재시도 안내

### Phase 3: 배포 & 문서화

- git tag patch bump 제안 (`$VERSION` 설정) + 배포 명령어 안내 (사용자 실행)
- 릴리스 노트 + 사후 분석 문서 생성 → `$RELEASE_DOC` 저장
- CLAUDE.md current feature 원복

---

## 6. 긴급 모드 상세 (--emergency)

### Phase 1: 문제 정의 & Thor 긴급 체크

**description 수집** (기본 모드와 동일)

**Thor (Platform) 긴급 체크:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚡ Thor (Platform): 긴급 배포 전 확인
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] 1. 롤백 방법을 알고 있음 (이전 태그 또는 이전 이미지)
[ ] 2. 모니터링 대시보드 확인 중
```

**Thor 응답 처리:**
- 모두 확인 → `THOR_RESULT="Thor: GO — 롤백 준비됨, 모니터링 확인"`, Phase 2 진행
- 미완료 항목 → Thor NO-GO, 중단:
  ```
  🛑 Thor: NO-GO — 긴급 배포 전 롤백 준비가 필요합니다.
  → 롤백 방법 확인 후 /sdlc:hotfix --emergency 를 다시 실행하세요.
  → 또는 지금 바로 롤백: git revert <commit> 또는 이전 태그 재배포
  ```

**dry-run 모드:** Thor GO 자동 통과

### Phase 2: 브랜치 직접 생성 (Claude 실행)

```bash
git checkout main && git pull origin main
git checkout -b hotfix/<description>
```

실행 후 확인 메시지 출력:
```
✅ 브랜치 생성 완료: hotfix/<description>
→ 지금 이 브랜치에서 수정을 진행하세요.
```

**dry-run 모드:** 명령어를 출력만 하고 실행하지 않음.

### Phase 3: 구현 & PR 체크리스트

사용자에게 출력하고 응답을 기다린다:

```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚨 긴급 Hotfix 구현 & PR 체크리스트
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[ ] 1. hotfix 브랜치에서 수정 완료
[ ] 2. 로컬 테스트 통과
[ ] 3. 스테이징 검증 (긴급 시 생략 가능 — 사용자 판단)
[ ] 4. PR 생성 후 최소 1인 리뷰 & 승인 (필수, 생략 불가)
[ ] 5. PR이 main에 머지됨
```

**응답 처리:**
- 전부 확인 → Phase 4 진행
- 4번(PR 리뷰) 미확인 → 중단, "PR 리뷰는 긴급 모드에서도 필수입니다."
- 기타 미완료 → 해당 항목 명시 후 중단

### Phase 4: 즉시 배포 & 문서화

- git tag patch bump 제안 + 배포 명령어 안내 (사용자 실행)
- 30분 모니터링 체크리스트 출력:
  ```
  배포 후 30분 모니터링:
  [ ] 에러율 정상 범위 유지
  [ ] p95 응답시간 SLO 이하
  [ ] 핵심 기능 정상 동작
  ```
- 릴리스 노트 + 사후 분석 문서 생성
- CLAUDE.md current feature 원복

---

## 7. 산출물

```
docs/releases/hotfix-<description>-<YYYY-MM-DD>.md
```

**문서 구조:**
```markdown
# Hotfix: <description> — <YYYY-MM-DD>

- 모드: emergency | standard
- 버전: v<X.Y.Z>
- 영향 범위: <IMPACT>

## 문제 정의
<DESCRIPTION + IMPACT>

## 수정 내용
- <변경 요약 — 사용자가 작성>

## 배포
- 브랜치: hotfix/<description>
- PR: <링크 또는 번호>
- 배포 시각: <사용자 기록>

## 롤백 기준

판단 기준 (하나라도 해당 시):
- 에러율 평소 대비 2배 이상, 5분 지속
- p95 응답시간 SLO 초과, 10분 지속
- 핵심 기능(결제·로그인 등) 동작 불가

롤백 명령:
git revert <merge-commit-hash>
# 또는 이전 태그 재배포

## 사후 분석 (Post-mortem)

### 근본 원인
(작성 필요)

### 재발 방지 조치
(작성 필요)

### 타임라인
(작성 필요)
```

긴급 모드에서는 `## Go/No-go` 섹션 추가:
```markdown
## Go/No-go
<THOR_RESULT>
```

---

## 8. 의존성

| 항목 | 내용 |
|------|------|
| 선행 커맨드 | 없음 (긴급 특성상 독립 실행) |
| 읽는 파일 | `CLAUDE.md` (current feature 원복용) |
| 쓰는 파일 | `docs/releases/hotfix-<description>-<YYYY-MM-DD>.md`, `CLAUDE.md` |
| 페르소나 | Thor (platform) — 긴급 모드 Phase 1만 |
| 스크립트 | 없음 (Plan resolve 불필요) |

---

## 9. 범위 밖

- 실제 코드 수정 (구현은 사용자)
- 배포 명령 직접 실행 (안내만)
- 배포 후 실시간 모니터링 (체크리스트 안내만)
- 회고 (`/sdlc:retrospective` 담당)
- 일반 버그 추적 (`/sdlc:bug` 담당)
