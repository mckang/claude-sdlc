---
name: sdlc-roles
description: Use when selecting meeting participants, planning a /sdlc:meeting, or when user asks about available personas/roles in the SDLC plugin
---

# 페르소나 목록

`${CLAUDE_PLUGIN_ROOT}/agents/` 디렉터리를 `Glob`으로 스캔해서 사용 가능한 페르소나를 **tier 별로** 두 개 표로 나눠 보여라.

각 페르소나 파일을 `Read`로 열어서 frontmatter의 `name`, `display_name`, `emoji`, `role`, `tier` 를 추출한다. 본문 첫 "## 전문 분야" 또는 "## 역할" 섹션의 요약 한 줄도 추출해 "전문" 열에 첨부한다.

`tier` 값 기준 분기:
- `essential` — 거의 모든 프로젝트에서 호출되는 코어 페르소나 (frontmatter에 `tier:` 없으면 `essential` 로 간주)
- `specialized` — 주제가 해당 영역에 닿을 때만 호출되는 페르소나

출력 형식:

```markdown
# 사용 가능한 미팅 참석자

## ⭐ Essential (N) — 거의 모든 미팅에 호출

| 이모지 | 이름 | 키워드 | 역할 | 전문 |
|--------|------|--------|------|------|
| 🎩 | Nick | facilitator | Meeting Facilitator | 진행자 (자동 참여) |

## 🧩 Specialized (M) — 주제에 맞을 때만 호출

| 이모지 | 이름 | 키워드 | 역할 | 전문 |
|--------|------|--------|------|------|
| 🛡️ | Strange | compliance | Security & Legal | OWASP·위협·개인정보·라이선스 |

총 N+M 명의 페르소나가 사용 가능합니다.
```

`tier` 필드가 기대값이 아니면 `specialized` 로 강등 후 경고 1줄 출력.
