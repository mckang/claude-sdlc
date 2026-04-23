# 실행 계획: <제목>

- **작성일**: <YYYY-MM-DD>
- **참조 PRD**: <PRD 경로>
- **참조 아키텍처**: <Architecture 경로>
- **참조 Design**: docs/design/<NAME>/ (트랙: <DESIGN_TRACKS>)   <!-- Design 디렉터리·트랙이 없으면 이 라인 전체를 삭제. 빈 괄호 금지. -->
- **기술 스택**: <감지된 스택>
- **상태**: draft | approved | in_progress | done

## 요약
- Epic: <N>개
- Story: <M>개
- Task: <K>개
- 예상 기간: <N>주 (버퍼 포함)
- 마일스톤: <M>개

## 마일스톤
| ID | 이름 | 목표일 (주차) | 기준 |
|----|------|---------------|------|
| M1 | ... | 주 2 | 스테이징 배포 |
| M2 | ... | 주 5 | 베타 오픈 |
| ... |

## Epic·Story·Task 분해

### E1: <Epic 이름>
**목표**: <한 문장 요약>
**예상 크기**: S/M/L/XL 합산
**마일스톤**: M1

#### E1-S1: <Story 제목>
- **담당 영역**: backend, data
- **크기**: M
- **설명**: ...
- **수용 기준**:
  - AC-1: Given ~ When ~ Then ~
  - AC-2: ...
- **DoD**:
  - [ ] 단위 테스트 통과
  - [ ] 코드 리뷰 통과
  - [ ] 스테이징 배포 확인
  - [ ] (Story별 추가 기준)

**Task**:
| ID | 제목 | 담당 | 크기 |
|----|------|------|------|
| E1-S1-T1 | ... | data | S |
| E1-S1-T2 | ... | backend | M |
| ... |

#### E1-S2: ...

### E2: ...

## 크리티컬 패스

<텍스트 설명, 의존성 다이어그램은 별도 deps 파일 참조>

E1-S1 (DB) → E1-S3 (Auth API) → E1-S5 (Login UI) → E2-S1 (상품 조회) → ...

## 리스크 및 완화

| ID | 등급 | 내용 | 완화 전략 | 담당 |
|----|------|------|-----------|------|
| R1 | 🔴 | ... | ... | compliance |
| R2 | 🟡 | ... | ... | data |
| ... |

## 가정 및 미결 사항
- ...

## 반대 의견 보존

회의 중 채택되지 않은 의견을 "보존" 만 하면 영구 보류와 구분되지 않는다. 각 항목은 아래 형식으로 기록해 **다음 retrospective 때 종결 여부를 추적**한다.

```yaml
- speaker: <이름 · 역할>
  opinion: "한 줄 요약"
  reason_not_adopted: 왜 이번 Plan 에 채택하지 않았는가
  resolved_by: open | retro-<YYYY-MM-DD> | v<semver> | out_of_scope
  review_trigger: 언제 다시 꺼낼지 (예: "회고 시", "다음 주요 버전", "해당 기능 실제 운영 후")
```

`resolved_by` 값의 의미:
- `open` — 아직 미결 (기본값). 다음 retro 에서 확인.
- `retro-<YYYY-MM-DD>` — 해당 retro 에서 공식 종결됨 (채택 또는 폐기).
- `v<semver>` — 해당 버전에서 반영됨 (예: `v1.7.0`).
- `out_of_scope` — 현재 feature 범위와 무관하다고 공식 판정.

예시:
```yaml
- speaker: Tony · Architect
  opinion: "테스트 없이 예제 내보내는 게 표준에 어긋난다."
  reason_not_adopted: 예제는 SDLC 산출물 레퍼런스가 주 목적이며 테스트는 standards/frontend/testing.md 참조로 충분
  resolved_by: v1.7.0
  review_trigger: v1.7.0 릴리스 시 vitest 예제 추가로 종결
```

## 회의 로그
<전체 회의 대화 발언 순서·헤더 보존하며 append>
