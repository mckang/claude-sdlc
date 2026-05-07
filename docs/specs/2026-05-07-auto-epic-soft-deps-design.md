# Design Spec: auto-epic soft deps 위상정렬 분리

- **작성일**: 2026-05-07
- **상태**: 작성 중 (사용자 검토 대기)
- **관련 커맨드**: `commands/auto-epic.md` (수정), `templates/reports/plan/deps.md` (수정)
- **선행 PR**: v1.10.0 (cwd 가드 + 자동 reset). 본 PR 은 deps 처리 영역만 다루며 cwd 가드 영역과 충돌 없음.
- **대상 플러그인 버전**: v1.10.0 → v1.11.0
- **관련 인계 문서**: `temp1/docs/handoffs/sdlc-plugin-hardening.md` 항목 4 (A8)

---

## 1. 목적

`/sdlc:auto-epic` 의 deps.md 파서·위상정렬이 mermaid 의 하드 (`-->`) 와 소프트 (`-.->`) 의존을 동일 처리해 **소프트 의존만 있는 Story 가 불필요하게 직렬 실행**되는 병렬화 기회 손실을 해결한다.

배경: 소프트 의존은 "선행 Story 의 합의/계약 (props/API/스키마 또는 Mock 인터페이스) 만 필요" 한 관계다. 코드 자체가 완료될 필요가 없어 architecture 단계에서 합의가 끝나면 병렬 실행 가능하다.

핸드오프 사례 (E1-S5 → E2-S1 / E4-S1): 재사용 컴포넌트 props 합의만 필요한 케이스가 hard 와 동일 처리되어 직렬 실행됨. 본 PR 로 같은 레벨 병렬 dispatch 가능해진다.

---

## 2. 범위

### 포함
- `commands/auto-epic.md` §2-3 (deps 파싱 + 위상정렬): 하드/소프트 분리 처리 명시.
- `commands/auto-epic.md` §2-4 (실행 플랜 미리 보고): soft advisory 라인 추가.
- `commands/auto-epic.md` Step 3-1 사전 캡처: Story 별 `SOFT_PREDECESSORS` 계산.
- `commands/auto-epic.md` Subagent 프롬프트 컨텍스트: `<SOFT_PREDECESSORS>` 자리표시 + 조건부 advisory bullet 사용 정책.
- `templates/reports/plan/deps.md` 범례: 소프트 의존 의미 확장.
- 버전 동시 bump v1.10.0 → v1.11.0 + README changelog.

### 제외 (별도 트랙)
- architecture-<NAME>.md 의 합의 섹션 자동 검증 (LLM 사람-수준 판단으로 충분).
- Wrapper 의 advisory 준수 강제 (실효성 낮음).
- Soft cycle 차단 (block 안 되니 actionable 신호 약함 — 무시 정책).
- A3 detection 가이드 강화 (별도 PR 후보).

---

## 3. 변경 상세

### 3-1. deps 파싱 + 위상정렬 (§2-3)

**위치**: `commands/auto-epic.md` 현재 line 95~110.

**현재 동작**:
- 정규식이 hard/soft 엣지를 모두 추출 후 동일 그래프에 투입.
- 라인 101 주석: "v1 에서는 하드와 동일하게 취급".
- Kahn 위상정렬이 합쳐진 그래프 위에서 동작 → soft 도 block.

**변경 후 동작**:
- hard/soft 엣지를 **별도 set 으로 보관**.
- Kahn 위상정렬은 **hard 엣지만** 입력으로 사용.
- soft 엣지는 `soft_predecessors[S]` map (consumer Story → 선행 Story 리스트) 로 advisory 보관.
- Cycle 검사도 **hard 그래프에만** 적용. soft cycle 은 정보성 1줄 출력만.

**§2-3 본문 재작성**:
```markdown
### 2-3. deps.md 파싱 + 위상정렬 (v1.11.0 부터: hard/soft 분리)

Plan 파일 옆의 `<PLAN>.deps.md` 가 있으면 `Read` 로 로드.

- Mermaid 블록 안의 엣지 추출:
  - **하드 의존** (실선): `^\s*(E\d+S\w+)\s*-->\s*(E\d+S\w+)` → `hard_edges`
  - **소프트 의존** (점선): `^\s*(E\d+S\w+)\s*-\.->\s*(E\d+S\w+)` → `soft_edges`
- 노드 ID (`E1S1`) → Story ID (`E1-S1`) 변환: `^(E\d+)(S\w+)$` 매칭 후 하이픈.
- **필터**: 현재 Epic 의 Story 가 아닌 노드는 두 set 에서 모두 제거.
- 위상정렬 입력: **`hard_edges` 만**. Kahn's algorithm 으로 레벨 그룹 생성.
  - Level 1 = hard 엣지가 들어오지 않는 Story
  - Level n+1 = Level 1~n 의 Story 가 모두 제거되었을 때 hard 엣지가 들어오지 않는 Story
- 소프트 advisory 테이블: `soft_predecessors[S] = {X | (X,S) ∈ soft_edges}`.
  consumer Story 의 prompt 치환 시 advisory bullet 으로 surface.

**Cycle 검사**:
- `hard_edges` 에 cycle → 기존대로 즉시 중단:
  `❌ deps.md 의 hard 엣지에 순환 의존성 존재 (<사이클 Story 목록>). 수동 수정 필요.`
- `soft_edges` 만의 cycle → 정보성 1줄 출력 후 계속:
  `ℹ️ deps.md 의 soft 엣지에 순환 발견 (<사이클>). advisory 로만 처리되므로 block 안 됨.`
- hard 와 soft 가 섞인 cycle → hard 만 추출해 검사.

deps.md 가 없거나 비어 있음 → 기존 동작 그대로 (sequential 자동 폴백).
```

### 3-2. 실행 플랜 미리 보고 (§2-4)

**위치**: 현재 line 114~125 부근.

Level 출력 포맷에 soft advisory 라인 추가 (해당 Story 가 있을 때만):

기존:
```
- Level 1 (병렬 2): E1-S3, E1-S4
```

변경 후:
```
- Level 1 (병렬 3): E1-S3, E1-S4, E1-S5
  └ soft advisory: E1-S5 ← {E2-S1, E4-S1} (architecture 합의 후 진행)
```

규칙:
- 해당 레벨 안의 Story 중 `soft_predecessors[S]` 가 non-empty 인 것만 한 줄씩 출력.
- 없으면 advisory 라인 자체 생략.

추가 한 줄 (Level 출력 직후):
```
- Soft 의존 처리: hard 만 위상정렬 block, soft 는 consumer 측 advisory bullet 으로 surface.
```

### 3-3. Wrapper 사전 캡처 — Story 별 SOFT_PREDECESSORS 계산

**위치**: Step 3-1 사전 캡처 (현재 line 169~) 의 "Story 별" 블록.

기존 (v1.10.0):
```bash
STORY_BRANCH="story/${STORY_ID}-${SLUG}"
```

변경 후:
```bash
STORY_BRANCH="story/${STORY_ID}-${SLUG}"
SOFT_PREDECESSORS="$(soft_predecessors[STORY_ID])"   # 예: "E2-S1, E4-S1" 또는 빈 문자열
```

치환 흐름 추가:
- `<SOFT_PREDECESSORS>` → 각 subagent prompt 의 자리표시. 빈 문자열이면 prompt 의 advisory bullet 자체를 생략 (조건부 치환).

### 3-4. Subagent 프롬프트 컨텍스트 — soft advisory bullet

**위치**: subagent 프롬프트 "## 컨텍스트" 섹션 (v1.10.0 의 STORY_BRANCH bullet 다음).

조건부 추가 (wrapper 가 `SOFT_PREDECESSORS` 가 non-empty 인 Story 에만 prompt 에 삽입):
```markdown
- Soft 의존 advisory: 선행 Story `<SOFT_PREDECESSORS>` 의 합의 (props/API/스키마 또는 Mock 인터페이스) 가 `docs/architecture/architecture-<NAME>.md` 에 명시되어 있는지 *먼저* 확인. 합의 미명시 시 코드 작성 전 즉시 `STATUS: needs_user | questions: <Soft 선행 Story 합의 미명시: 어느 항목>` 으로 반환.
```

규칙:
- `SOFT_PREDECESSORS` 가 비어 있는 Story 의 prompt 에는 본 bullet 자체를 넣지 않는다 (불필요 noise 제거).
- advisory 미준수 시 코드 결함 아님 → `STATUS: failed | reason: verify-fail:...` 가 아니라 `needs_user` (사용자 architecture 보강 필요) 경로 사용.

### 3-5. deps 템플릿 범례 갱신

**위치**: `templates/reports/plan/deps.md` 의 "### 범례" 섹션.

기존:
```
- 점선 화살표: 소프트 의존 (Mock 등으로 우회 가능)
```

변경 후:
```
- 점선 화살표: 소프트 의존 — 선행 Story 의 *합의/계약* (props/API/스키마 또는 Mock 인터페이스) 만 필요. `/sdlc:auto-epic` v1.11.0+ 위상정렬에서 **블로킹 X**, consumer Story 의 advisory 로만 처리. 합의는 architecture 단계에서 결정해 두어야 함.
```

`templates/reports/plan/deps.md` 는 사용자 프로젝트로 복사되는 템플릿이지만, 범례는 정보성 텍스트라 기존 deps.md 파일에 미반영되어도 동작 변화 없음 (parser 측 변경만으로 효과 발생).

### 3-6. 버전 bump + changelog

- `.claude-plugin/plugin.json` + `marketplace.json`: v1.10.0 → v1.11.0.
- `README.md` changelog 에 v1.11.0 항목.

---

## 4. 호환성

- **Backward compat**: 기존 deps.md 파일은 그대로 사용 가능. 차이는 점선 엣지가 이전엔 hard 처럼 block 했고 이제는 advisory 로만 처리 — 이는 *기능 개선* 이고 사고 발생 X (병렬화 가능해질 뿐).
- **Forward compat**: deps 템플릿 범례 갱신은 신규 plan 부터 자동 반영. 기존 plan 의 deps.md 는 사용자가 수동 갱신할 필요 없음 — 범례 텍스트는 동작에 영향 없고, 엣지 syntax 는 동일.
- **STATUS 표 영향**: 본 PR 은 새 STATUS 코드를 추가하지 않는다. advisory 미준수 시 `needs_user` (기존 코드) 사용. v1.9.0 의 STATUS 매트릭스 그대로.

---

## 5. 검증 시나리오

본 PR 의 합격 기준:

1. **Parser 분리**: §2-3 변경 후 텍스트가 `hard_edges` / `soft_edges` 두 set 을 별도로 명시. Kahn 입력이 hard 만임을 명문화.
2. **Cycle 검사 분리**: hard cycle = 즉시 중단 (기존 동작), soft-only cycle = 정보성 1줄 + 계속 진행. 본문 텍스트로 양쪽 모두 명시.
3. **Plan 미리 보고**: 예시 출력에 soft advisory 줄이 등장 (해당 Story 가 있을 때만 조건부).
4. **Wrapper 사전 캡처**: Story 별 블록에 `SOFT_PREDECESSORS` 추가 — 빈 문자열 가능 명시.
5. **Subagent prompt**: 컨텍스트 섹션에 `<SOFT_PREDECESSORS>` 자리표시 + advisory 미준수 시 `needs_user` 경로 명시.
6. **deps 템플릿 범례**: "Mock 등으로 우회 가능" 단일 표현 → "합의/계약 + auto-epic 동작" 확장 표현.
7. **버전**: v1.11.0 동시 bump + README changelog 항목.
8. **호환성 회귀**: v1.10.0 의 cwd 가드, base anchor, STATUS 매트릭스 영역은 변경 없음. 회귀 0건.

실 회귀 (실제 plan + deps.md 로 dispatch 해 병렬화 효과 확인) 는 외부 프로젝트 사용 시 검증.

---

## 6. 후속 PR

본 PR 완료 후 핸드오프 4 항목 모두 종결 (A1·A2·A3 부분·A4). 추가 후보:

- A3 detection 가이드 강화 — 단, v1.9.0 의 verify.md §4.5 에 환경 충돌 패턴 가이드가 이미 있어 우선순위 낮음.
- 기타 사용 중 발생할 retro 항목들.

---

## 7. 버전 정책

본 PR 머지 시:
- `plugin.json` / `marketplace.json`: v1.10.0 → v1.11.0 (minor — 기능 개선, 기존 호환).
- `README.md` changelog 에 v1.11.0 항목.
