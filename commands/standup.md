---
argument-hint: [Plan파일경로] [--since=<날짜|어제|지난스탠드업>]
description: Plan + git 히스토리 기반 일일 스탠드업 리포트 자동 생성
allowed-tools: Read, Write, Edit, Glob, Grep, Bash
---

# 스탠드업 리포트 생성

사용자가 `/standup <Plan파일> [--since=...]` 형태로 호출했다.
전체 인자: `$ARGUMENTS`

예시:
```
/standup ${CLAUDE_PROJECT_DIR}/docs/plans/email-verification.md
/standup ${CLAUDE_PROJECT_DIR}/docs/plans/email-verification.md --since=어제
/standup ${CLAUDE_PROJECT_DIR}/docs/plans/email-verification.md --since=2026-04-18
```

## 1단계: 인자 파싱

- `$1`: Plan 경로 (필수)
- `--since=` 플래그 (선택) — 기본: 마지막 스탠드업 또는 24시간 전
  - `어제`: 전날 00:00 이후
  - `지난스탠드업`: 마지막 스탠드업 파일의 작성 시각
  - ISO 날짜 (`2026-04-18`)

## 2단계: Plan 및 스냅샷 로드

- Plan 파일 `Read`
- Plan 상단의 "📊 최근 상태 스냅샷" 섹션 있으면 참조 (이전 상태 파악용)
- `${CLAUDE_PROJECT_DIR}/docs/plans/.deps.md` 있으면 의존성 참조

이전 스탠드업 있는지 확인:
```bash
ls ${CLAUDE_PROJECT_DIR}/docs/standups/ 2>/dev/null | tail -5
```

## 3단계: Git 히스토리 수집

지정된 기간의 커밋·파일 변경 수집:

```bash
# since 기준 커밋 목록
git log --since="$SINCE" --pretty=format:"%h|%an|%s|%ad" --date=iso

# 변경된 파일 통계
git log --since="$SINCE" --numstat --pretty=format:"%h"

# 현재 브랜치
git branch --show-current

# staged / unstaged 변경
git status --short
```

git 사용 불가 (git repo 아님 등) → 경고하고 Plan 변경 로그만으로 진행.

## 4단계: Plan 상태 변화 감지

이전 스탠드업이 있다면 그때 스냅샷과 현재 Plan 체크박스 비교:

- 완료된 Task (`[~]` or `[ ]` → `[x]`)
- 새로 시작한 Task (`[ ]` → `[~]`)
- 새로 블로킹된 Task (`[ ]` or `[~]` → `[!]`)
- 블로킹 해제된 Task (`[!]` → `[~]` or `[x]`)

이전 스탠드업 없으면 현재 상태만 집계.

## 5단계: 참석자 선정

기본: `facilitator`, `scrum-master`, `planner`  
Plan의 담당 영역에 따라 추가: `backend`, `frontend`, `dba`, `qa` 등

단, **스탠드업은 간결해야 하므로** 페르소나가 전부 발언하지 않음. Scrum Master·Planner가 주로 발언하고, 영역별 페르소나는 자기 담당 Task 상태만 짧게 언급.

## 6단계: 리포트 생성

하나의 응답 안에서 생성. 톤은 **간결·사실 중심**. 회고처럼 길면 안 됨.

### 리포트 형식

```markdown
# 📅 스탠드업: {Plan 제목}

- **날짜**: 2026-04-21 (수)
- **범위**: 2026-04-20 09:00 ~ 현재
- **Plan**: {경로}

## 한 줄 요약

> {Scrum Master의 1-2문장 요약. 예: "어제 E1-S1 완료, 오늘 E1-S2 시작, 블로커 1건(SES 승인 대기)"}

---

## 🟢 어제 진행 (완료 N · 진행중 M)

**완료된 Task**:
- ✅ E1-S1-T1: users 컬럼 마이그레이션 (dba)
- ✅ E1-S1-T2: tokens 테이블 생성 (dba)

**진행 중 → 완료**:
- ✅ E1-S1 (Story 완료) — 담당 dba

**커밋 요약** (git 기반):
- 5개 커밋 / 3개 파일 변경 / +142 -18
- 주요: `feat(auth): V020 마이그레이션`, `feat(auth): V021 tokens 테이블`

---

## 🟡 오늘 계획

**착수 예정**:
- ⚪→🔄 E1-S2-T1: 토큰 생성 서비스 (backend, M)
- ⚪→🔄 E1-S2-T2: 토큰 검증 서비스 (backend, M)

**병렬 가능 (의존성 체크)**:
- E2-S1-T1: SES 메일 템플릿 작성 (backend, S) — E1 완료 대기 아님

**Scrum Master 조언**:
> "E1-S2는 backend 단독, 오늘 마무리 가능. 여유 있으면 E2-S1-T1을 앞당겨 SES 승인 지연 리스크 완화."

---

## ⚠️ 블로커 / 리스크

### 현재 블로커 1건

| ID | Task | 담당 | 원인 | 경과 | 크리티컬 패스 |
|----|------|------|------|------|---------------|
| E2-S1-T3 | SES 프로덕션 access | backend+cloud | AWS 승인 대기 | 2일차 | **YES** |

**Planner 의견**:
> "2일 더 늦으면 M2 마일스톤 영향. 대안: SES sandbox 상태에서 테스트 도메인으로 선행 개발 가능."

### 리스크 업데이트

- 🔴 R1 (SES 정책) — 진행 중 (T3 블로킹과 연관)
- 🟡 R2 (DB 마이그레이션 락) — ✅ 해소 (E1-S1 온라인 적용 성공)

---

## 📊 마일스톤 진행

| ID | 이름 | 목표 | 진행 | 상태 |
|----|------|------|------|------|
| M1 | 인증 기본 | 주 2 (3일 남음) | 75% | 🟡 on track |
| M2 | 재전송 완성 | 주 4 | 20% | ⬜ 예정 |

---

## 🎯 액션 아이템 (오늘)

- [ ] E2-S1-T3 AWS 승인 상태 확인 (backend) — 오전 중
- [ ] E1-S2 킥오프 (`/story start E1-S2`) — 10:00
- [ ] SES sandbox 대안 POC 판단 — Planner와 30분 싱크

---

## 🧭 다음 스탠드업 (내일)

예상 안건:
- E1-S2 완료 여부
- SES 블로커 해제 또는 대안 결정
- M1 마일스톤 달성 확정 (주 2 마감)
```

## 7단계: 저장

`${CLAUDE_PROJECT_DIR}/docs/standups/<YYYY-MM-DD>.md` 로 저장.
없는 디렉터리면 `mkdir -p ${CLAUDE_PROJECT_DIR}/docs/standups`.

같은 날 이미 스탠드업 있으면:
- 기존 파일에 "## 추가 업데이트 (14:30)" 형태로 append
- 또는 새 파일 `<YYYY-MM-DD>-2.md`

사용자에게 물어보지 말고 **기본은 append**.

## 8단계: 완료 보고

```
✅ 스탠드업 리포트 생성 완료

날짜: 2026-04-21
산출물: ${CLAUDE_PROJECT_DIR}/docs/standups/2026-04-21.md

요약:
- 완료 Task: 2개
- 새로 착수: 2개
- 블로커: 1건 (크리티컬)
- 마일스톤 M1: 75% (3일 남음, on track)

주요 액션:
1. SES 승인 확인 (오전)
2. E1-S2 킥오프 (/story start E1-S2)
```

## 주의사항

- **간결성이 핵심** — 회의록이 아니라 리포트. 각 섹션 짧게.
- git 로그 파싱 시 머지 커밋은 제외 (`--no-merges`)
- 이전 스냅샷 없으면 "첫 스탠드업" 명시
- 블로커가 여러 개면 **크리티컬 패스 위 블로커를 먼저** 보여줌
- Scrum Master·Planner 의견은 **데이터 기반**, 추측 금지
- 페르소나별 발언은 최소화 — 전체 대화 로그 없음

## 에러 처리

- git repo 아님 → git 섹션 생략, Plan 변경만으로 리포트
- Plan에 체크박스 없음 → 현재 완료 상태 파악 불가, "체크박스 표기 필요" 안내
- `--since` 날짜 잘못 → 사용자에게 올바른 형식 안내 (ISO 또는 `어제`)

## 팁 (사용자 참고)

- 매일 아침 팀 슬랙에 붙여넣기 좋은 포맷
- `--since=어제` 기본 사용 가정
- 일주일치 보려면 `--since=2026-04-15` 식으로
