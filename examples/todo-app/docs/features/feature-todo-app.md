# Feature: 로컬 저장 Todo 관리 웹앱

- **식별자**: todo-app
- **작성일**: 2026-04-23
- **작성자**: Thomas Kang
- **상태**: draft

## 개요

브라우저 localStorage 만으로 동작하는 가벼운 Todo 관리 웹앱. 서버·인증·계정 없음. 이 SDLC 플러그인의 전체 워크플로우(feature → PRD → Architecture → Plan → Story × N → PR)를 실제로 따라가 만든 **레퍼런스 예제**.

## 기능

### 핵심 (1차)
- 할 일 항목 추가 (텍스트 입력 + Enter 또는 버튼)
- 할 일 개별 삭제
- 완료/미완료 토글 (체크박스)
- localStorage 자동 영속화 (새로고침해도 유지)
- 상태별 필터 보기: 전체 · 미완료 · 완료
- 남은 항목 개수 표시 + 빈 상태 안내

### 나중 고려
- 드래그로 순서 변경
- 완료 일시 저장·정렬
- 다크 모드
- 다국어
- IndexedDB 로 이관 (용량 증가 시)

## 결정 필요
- [ ] 없음 — 모든 결정은 플러그인 방법론에 따라 PRD/Architecture 단계에서 내린다.

## 다음 단계
- [x] 공식 PRD 로 발전: [prd-todo-app.md](../prd/prd-todo-app.md)
