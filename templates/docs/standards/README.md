# Engineering Standards

이 프로젝트의 팀 표준 문서 모음. 페르소나는 미팅에서 이 문서들을 **권위 있는 기준**으로 참조한다.

## 문서 구조

```
docs/standards/
├── backend/
│   ├── springboot/       (5 files)    # Java / Spring Boot
│   ├── nextjs-typescript/ (5 files)    # Node.js / Next.js API
│   └── fastapi/          (5 files)    # Python / FastAPI
├── frontend/             (5 files)    # Next.js + Tailwind + shadcn
└── database/             (4 files)    # 공통 DB 표준
```

모든 백엔드 스택은 **동일한 5개 축**으로 구성:
- **api.md**: URI·HTTP·요청/응답·에러 표준
- **structure.md**: 프로젝트 레이아웃·레이어·의존성
- **testing.md**: 단위·통합·E2E 테스트 전략
- **security.md**: 인증·인가·비밀·입력 검증
- **observability.md**: 로깅·메트릭·트레이싱

## 스택별 빠른 참조

### Java / Spring Boot
- [API 설계](backend/springboot/api.md)
- [프로젝트 구조](backend/springboot/structure.md)
- [테스트](backend/springboot/testing.md)
- [보안](backend/springboot/security.md)
- [옵저버빌리티](backend/springboot/observability.md)

### TypeScript / Next.js Backend
- [API 설계](backend/nextjs-typescript/api.md)
- [프로젝트 구조](backend/nextjs-typescript/structure.md)
- [테스트](backend/nextjs-typescript/testing.md)
- [보안](backend/nextjs-typescript/security.md)
- [옵저버빌리티](backend/nextjs-typescript/observability.md)

### Python / FastAPI
- [API 설계](backend/fastapi/api.md)
- [프로젝트 구조](backend/fastapi/structure.md)
- [테스트](backend/fastapi/testing.md)
- [보안](backend/fastapi/security.md)
- [옵저버빌리티](backend/fastapi/observability.md)

### Frontend
- [Next.js (App Router)](frontend/nextjs.md)
- [Tailwind CSS](frontend/styling-tailwind.md)
- [shadcn/ui](frontend/components-shadcn.md)
- [상태 관리](frontend/state-management.md)
- [테스트](frontend/testing.md)

### Database (공통)
- [명명 규칙](database/naming.md)
- [스키마 설계](database/schema-design.md)
- [마이그레이션 전략](database/migrations.md)
- [성능](database/performance.md)

## 사용 방법

### 1. 미팅에서 참조

각 페르소나는 자기 영역의 표준을 **자동으로 참조**한다.
- `backend` 페르소나 참석 시 관련 백엔드 표준 로드
- `frontend` 페르소나 참석 시 frontend 표준 로드
- `data` 페르소나 참석 시 database 표준 로드

주제에 따라 어느 스택 표준을 쓸지는 **주제에 명시하거나** 페르소나가 판단한다.

### 2. 코드 리뷰·개발

Claude Code 세션에서 직접 읽어 참조:
```
> docs/standards/backend/springboot/api.md 를 참고해서 이 컨트롤러를 리뷰해줘
```

### 3. 새 팀원 온보딩

신규 입사자에게 이 디렉터리를 가이드로 제공. 각 문서가 "왜"를 포함하므로 학습 자료로도 활용.

## 유지보수

### 버전 정보

각 문서 상단에 **기준 버전**과 **최종 갱신** 날짜 명시. 예:
```
**기준 버전**: Spring Boot 3.x / Java 21
**최종 갱신**: 2026-04
```

### 갱신 주기

- **분기마다** 각 문서 상단 버전 확인
- **Major 릴리스** 있을 때 관련 문서 재검토
- **PR 리뷰에서 표준 위반** 발견 시 표준 자체가 맞는지 역검토 (예외는 표준에 기록)

### 수정 원칙

- 규칙 변경 시 반드시 **왜** 변경하는지 기록
- 예외는 예외로 명시 ("일반적으로는 X, 단 Y 상황에서는 Z")
- 너무 많은 "경우에 따라" 나열은 가이드 아닌 혼란 → 과감히 우선순위 결정

## 스택이 여기 없으면?

- **Go, Rust, Ruby 등**: 이 디렉터리를 복사해 추가
- **다른 FE 프레임워크 (Vue, Svelte)**: `frontend/` 하위에 별도 파일
- **다른 DB (NoSQL)**: `database/` 하위에 별도 파일

신규 스택 추가 시 **동일한 5축 구조** 유지 권장 — 비교·참조 쉽게.
