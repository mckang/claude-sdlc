---
description: 사용 가능한 미팅 참석자(페르소나) 목록 표시 — tier 별로 분리 출력
allowed-tools: Read, Glob
---

# 페르소나 목록 표시

`${CLAUDE_PLUGIN_ROOT}/agents/` 디렉터리를 `Glob`으로 스캔해서 사용 가능한 페르소나를 **tier 별로** 두 개 표로 나눠 보여라.

각 페르소나 파일을 `Read`로 열어서 frontmatter의 `name`, `display_name`, `emoji`, `role`, `tier` 를 추출한다. 본문 첫 "## 전문 분야" 또는 "## 역할" 섹션의 요약 한 줄도 추출해 "전문" 열에 첨부한다.

`tier` 값 기준 분기:
- `essential` — 거의 모든 프로젝트에서 호출되는 코어 페르소나 (기본값 — frontmatter 에 `tier:` 없으면 `essential` 로 간주해 관대하게 처리)
- `specialized` — 주제가 해당 영역에 닿을 때만 호출되는 페르소나

출력 형식:

```markdown
# 사용 가능한 미팅 참석자

## ⭐ Essential (N) — 거의 모든 미팅에 호출

| 이모지 | 이름 | 키워드 | 역할 | 전문 |
|--------|------|--------|------|------|
| 🎩 | Sean | facilitator | Meeting Facilitator | 진행자 (자동 참여) |
| 🏛️ | Winston | architect | Architect | 시스템 전체 구조·기술 선택 |
| ... | ... | ... | ... | ... |

## 🧩 Specialized (M) — 주제에 맞을 때만 호출

| 이모지 | 이름 | 키워드 | 역할 | 전문 |
|--------|------|--------|------|------|
| 🛡️ | Aria | security | Security Engineer | OWASP·위협 모델링 |
| ... | ... | ... | ... | ... |

총 N+M 명의 페르소나가 사용 가능합니다.

**사용법**: `/sdlc:meeting <키워드1, 키워드2> | <주제> | <산출물경로>`
**예시**: `/sdlc:meeting architect, backend, security | OAuth 토큰 저장 | ${CLAUDE_PROJECT_DIR}/docs/meetings/oauth.md`

> 💡 `plan`·`plan-review` 등 자동 참석자 선정은 essential 을 기본으로 고려하고, 주제 키워드가 감지되면 관련 specialized 도 함께 초청합니다.
```

파일이 없거나 frontmatter 파싱이 실패하면 경고하고 경로와 함께 표시한다. `tier` 필드가 기대값(`essential`/`specialized`) 이 아니면 `specialized` 로 강등해 표시하고 경고 1 줄 남긴다.
