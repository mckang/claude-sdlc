---
name: sdlc-commit-convention
description: Use when creating any git commit during story, auto-story, auto-epic, bug, or hotfix workflows in this SDLC plugin project
---

# 커밋 컨벤션

## 구현 커밋

```
<type>(<scope>): <STORY_ID> <한 줄 요약>

- <주요 변경 1>
- <주요 변경 2>
- <주의점/마이그레이션 노트>

Refs: <Plan 상대경로>#<STORY_ID>
```

**type 선택 기준:**

| type | 사용 조건 |
|------|-----------|
| `feat` | 새 기능·AC 구현 |
| `fix` | 버그 수정 (Story 내 수정 포함) |
| `refactor` | 동작 변화 없는 코드 정리 |
| `test` | 테스트만 추가·수정 |
| `docs` | 문서만 변경 |
| `chore` | 빌드·설정·의존성 변경 |

**scope**: 변경된 모듈·레이어 (예: `auth`, `api`, `db`, `ui`). 여러 영역이면 생략.

논리 단위가 여럿이면 **분할 커밋** (한 커밋 = 한 논리 단위).

## Plan 갱신 커밋

Story 완료 처리 시 구현 커밋과 **별도**로:

```
docs(plan): mark <STORY_ID> done [via auto-epic | via auto-story]
```

## 머지 커밋

```
Merge Story <STORY_ID>: <제목 한 줄> [(EpicID, auto-epic)]
```

마일스톤 데이터가 있으면: `Merge Story E1-S2: make ci 게이트 (M2 3/7)`

## 금지 사항

- `git push --force` 절대 금지
- Story 브랜치 이외 브랜치에 구현 커밋 금지
- `--no-verify` skip 금지
- `Refs:` 라인 생략 금지 (자동 crossref 추적에 사용)
