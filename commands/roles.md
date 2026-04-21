---
description: 사용 가능한 미팅 참석자(페르소나) 목록 표시
allowed-tools: Read, Glob
---

# 페르소나 목록 표시

`${CLAUDE_PLUGIN_ROOT}/agents/` 디렉터리를 `Glob`으로 스캔해서 사용 가능한 페르소나를 표로 정리해 보여라.

각 페르소나 파일을 `Read`로 열어서 frontmatter의 `name`, `display_name`, `emoji`, `role`을 추출해라. 그리고 본문 첫 "## 전문 분야" 또는 "## 역할" 섹션의 요약 한 줄을 추출해 첨부해라.

출력 형식:

```markdown
# 사용 가능한 미팅 참석자

| 이모지 | 이름 | 키워드 | 역할 | 전문 |
|--------|------|--------|------|------|
| 🎩 | Sean | facilitator | Meeting Facilitator | 진행자 (자동 참여) |
| 🏛️ | Winston | architect | Architect | 시스템 전체 구조·기술 선택 |
| ... | ... | ... | ... | ... |

총 N명의 페르소나가 사용 가능합니다.

**사용법**: `/meeting <키워드1, 키워드2> | <주제> | <산출물경로>`
**예시**: `/meeting architect, backend, security | OAuth 토큰 저장 | ${CLAUDE_PROJECT_DIR}/docs/meetings/oauth.md`
```

파일이 없거나 frontmatter 파싱이 실패하면 경고하고 경로와 함께 표시해라.
