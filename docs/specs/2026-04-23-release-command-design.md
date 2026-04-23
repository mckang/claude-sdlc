# Design Spec: /sdlc:release 커맨드

- **작성일**: 2026-04-23
- **상태**: 승인됨
- **관련 커맨드**: `commands/release.md` (신규)

---

## 1. 목적

`/sdlc:pr` 이후 실제 운영 배포까지의 공백을 메운다. PR 머지 → 배포 전 점검 → Go/No-go 결정 → 배포 명령 안내 → 롤백 문서화까지 3-Phase로 가이드하며, 규모 있는 개발에 익숙하지 않은 사용자에게 "릴리스는 단일 이벤트가 아니라 단계"임을 가르친다.

---

## 2. 커맨드 시그니처

```
/sdlc:release [Story ID | feature이름] [--story | --feature] [--dry-run]
```

| 인자 | 설명 |
|------|------|
| `Story ID` | `E1-S1` 형식, `--story` 모드에서 사용 |
| `feature이름` | feature 이름 또는 plan 경로, 생략 시 current feature |
| `--story` | 단일 Story 단위 릴리스. 첫 인자가 `E\d+-S\d+` 형식이면 자동 감지 |
| `--feature` | feature 전체 릴리스 (기본값) |
| `--dry-run` | 실제 확인 없이 체크리스트 문서만 생성 |

**사용 예시:**
```
/sdlc:release                          # current feature 릴리스
/sdlc:release checkout-v2              # feature 이름 지정
/sdlc:release E1-S1 --story           # 단일 Story 릴리스
/sdlc:release checkout-v2 --dry-run   # 체크리스트 문서만 생성
```

---

## 3. 전체 흐름

```
Phase 1: Pre-release     →    Phase 2: Go/No-go Gate    →    Phase 3: Post-release
(완료 검증·스테이징 확인)       (T'Challa + Thor 승인)          (배포 명령 안내·롤백 문서화)
```

**중단 규칙:**
- Phase 1 실패 → 사유 기록 후 중단, 수정 제안 후 재시도 안내
- Phase 2 NO-GO → 사유 기록 후 중단, 재시도 조건 명시
- Phase 3는 항상 완주 (배포 명령·롤백 정보 출력 후 산출물 저장)

---

## 4. Phase 1: Pre-release

### 자동 수집 (파일 읽기)

- Story/Feature의 `docs/plans/<name>/<StoryID>/complete.md` 에서 AC/DoD 완료 상태 파싱
- `--feature` 모드: Plan 파일 전체에서 미완료 Story(`[ ]`, `[~]`) 존재 여부 확인
- `docs/pr-drafts/<ID>.md` 존재 여부로 PR 생성 여부 확인

### 사용자 확인 항목

```
[ ] PR이 base 브랜치(main/master)에 머지됐음
[ ] 스테이징 환경에서 주요 플로우 직접 확인
[ ] 스테이징에서 AC 시나리오 재검증 완료
[ ] 롤백 방법을 알고 있음 (이전 버전 태그 또는 이전 이미지)
```

### 실패 조건

- `--feature` 모드에서 미완료 Story 존재 → 중단
- PR draft 상태 의심 시 경고 (사용자 확인 요청)
- 위 4개 항목 중 하나라도 미확인 → Phase 2 진행 불가

---

## 5. Phase 2: Go/No-go Gate

두 페르소나가 각자의 관점에서 확인 후 GO/NO-GO를 선언한다.

### T'Challa (PM) — 비즈니스 관점

확인 항목:
- 이해관계자 사전 공지 완료
- 출시 타이밍이 마케팅·외부 일정과 충돌 없음
- KPI 측정 방법 준비 (배포 후 무엇을 볼 것인가)
- 지원팀(CS)에 변경 내용 공유 완료

출력 형식:
```
📋 T'Challa (PM): GO ✅
사유: 이해관계자 공지 완료, KPI 대시보드 준비됨, CS 팀 사전 브리핑 완료.
```

### Thor (Platform) — 인프라 관점

확인 항목:
- 모니터링 대시보드·알람 설정 완료
- 배포 대상 환경의 리소스 여유 충분
- DB 마이그레이션 있으면 온라인 마이그레이션 검증 완료
- 롤백 실행 방법이 runbook에 존재

출력 형식:
```
⚡ Thor (Platform): GO ✅
사유: 알람 설정 확인, 마이그레이션 스테이징 검증 완료, runbook 업데이트됨.
```

### 최종 판정

- 둘 다 GO → Phase 3 진행
- 하나라도 NO-GO → 사유 문서화 후 중단, 재시도 조건 명시

---

## 6. Phase 3: Post-release

### 배포 명령 안내 (실행은 사용자)

```bash
# 1. Git 태그
git tag v<version> && git push origin v<version>

# 2. 배포
#    CI/CD 파이프라인 → 태그 push로 자동 트리거되는 경우
#    수동 배포 → docs/guides/development-workflow.md 참조
```

버전 번호는 현재 태그 기반으로 자동 제안 (없으면 `v0.1.0` 제안).

### 자동 생성 릴리스 노트

Story `complete.md` 파일들에서 추출:
```markdown
## 변경 내역 — <feature-name> (<YYYY-MM-DD>)

- feat: E1-S1 토큰 기반 인증 스키마
- feat: E1-S2 이메일 인증 플로우
- fix:  E1-S3 세션 만료 엣지케이스
```

### 롤백 기준 + 명령어 (문서에 기록)

```markdown
## 롤백 기준

판단 기준 (하나라도 해당 시):
- 에러율 평소 대비 2배 이상, 5분 지속
- p95 응답시간 SLO 초과, 10분 지속
- 핵심 기능(결제·로그인 등) 동작 불가

롤백 명령:
git revert <merge-commit-hash>
# 또는 이전 태그 재배포
```

---

## 7. 산출물

```
docs/releases/release-<feature-name>-<YYYY-MM-DD>.md
```

**문서 구조:**
```markdown
# Release: <feature-name> — <YYYY-MM-DD>

- 타입: story | feature
- 대상: <Story ID 또는 feature 이름>
- 버전: v<X.Y.Z>

## Phase 1: Pre-release ✅
(체크리스트 결과)

## Phase 2: Go/No-go ✅
T'Challa: GO — <사유>
Thor: GO — <사유>
최종: GO

## Phase 3: 배포
### 배포 명령
### 변경 내역
### 롤백 기준
```

---

## 8. 의존성

| 항목 | 내용 |
|------|------|
| 선행 커맨드 | `/sdlc:story complete`, `/sdlc:pr` |
| 읽는 파일 | `plan-<name>.md`, `<StoryID>/complete.md`, `pr-drafts/<ID>.md` |
| 쓰는 파일 | `docs/releases/release-<name>-<YYYY-MM-DD>.md` |
| 페르소나 | T'Challa (pm), Thor (platform) |
| 스크립트 | `scripts/resolve-plan-path.sh` |

---

## 9. 범위 밖

- 실제 배포 명령 실행 (안내만)
- 배포 후 모니터링 실시간 수행 (롤백 기준 문서화만)
- 인시던트 대응 (`/sdlc:hotfix` 담당)
- 릴리스 후 회고 (`/sdlc:retrospective` 담당)
