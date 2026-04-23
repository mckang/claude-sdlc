---
name: sdlc-onboard
description: Use when a new team member joins, user asks to generate an onboarding document, or project context summary is needed — aggregates PRD, architecture, plan, standards, and retrospective into one document
---

# 팀원 온보딩 요약 생성

## 입력 파악

대화 맥락에서 파악:
- **role** (선택): `backend` | `frontend` | `data` | `qa` | `fullstack` | `any` (기본)
- **feature** (선택): 특정 기능 이름 prefix. 없으면 current feature 또는 전체

## 자료 스캔

`Glob`으로 다음 수집:
- `docs/prd/*.md` — PRD (feature 지정 시 해당 prefix 필터)
- `docs/architecture/*.md`
- `docs/plans/*.md`
- `docs/retrospectives/*.md` — 최신 2개
- `docs/meetings/*.md` — 최신 5개
- `docs/standards/` — 구조만 (역할 기반 스택 필터)
- `docs/standups/*.md` — 최신 3개 (있으면)

## 각 문서 요약 추출

| 문서 | 추출 항목 |
|------|-----------|
| PRD | 배경 1-2줄·목표·핵심 FR 상위 5개·범위 외 |
| 아키텍처 | 기술 스택 표·mermaid 다이어그램(원본 보존)·주요 API 10개·핵심 테이블 |
| Plan | Epic 목록+진행률·현재 진행 Story·크리티컬 패스·마일스톤·리스크 |
| 표준 | 역할 관련 파일 경로만 (본문 미포함, 읽기 권장) |
| 회고 | 미완료 액션 아이템만 |
| 미팅 | 파일명 + 제목 1줄 |

## 역할별 강조

- **backend**: 백엔드 아키텍처 섹션·`docs/standards/backend/<스택>/`·backend 담당 Story
- **frontend**: 프론트엔드 섹션·`docs/standards/frontend/`·frontend 담당 Story
- **data**: 데이터 모델·인덱스·`docs/standards/database/`
- **qa**: testing 표준·Plan의 AC·DoD·알려진 버그
- **fullstack/any**: 모든 영역 균형

## 온보딩 문서 구조

다음 섹션으로 Markdown 문서 생성. **섹션당 5줄 이내** 요약 (원본 링크로 깊게 읽도록):

1. 프로젝트 개요 (배경·목표·비즈니스 가치)
2. 시스템 구조 (스택 표·다이어그램·주요 API)
3. 현재 진행 상황 (Plan 요약·진행 Story·블로커)
4. 당신의 역할 `{role}` — 표준 문서 경로·착수 가능 Story
5. 팀 문화·프로세스 (Story 사이클·커밋 규칙·PR 기준)
6. 최근 학습 사항 (회고 미완 액션만)
7. 유용한 명령어 (`/sdlc:status`, `/sdlc:story`, `/sdlc:meeting` 등)
8. 최근 미팅 이력
9. 막히면? (기술 질문·표준 충돌 대응)
10. 첫 주 제안 로드맵 (Day 1~5 + Week 2)

## 저장

`${CLAUDE_PROJECT_DIR}/docs/onboarding/<role>-<YYYY-MM-DD>.md` 로 저장.
feature 지정 시: `<feature>-<role>.md`

## 주의사항

- 원본 문서 대체 불가 — 요약·길잡이 역할, 원본 링크 필수
- 생성 후 사용자에게 검토 요청
- PRD·Plan 여러 개면 최신 또는 feature 지정된 것만
- 회고 미완 액션은 반드시 포함
