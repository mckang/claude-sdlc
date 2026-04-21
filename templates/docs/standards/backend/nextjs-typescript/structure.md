# Next.js TypeScript (Backend) — 프로젝트 구조

**기준 버전**: Next.js 15 (App Router) / TypeScript 5.x
**최종 갱신**: 2026-04

## 디렉터리 구조

```
.
├── app/                          # 라우팅 (페이지 + API)
│   ├── (marketing)/              # Route Group
│   ├── api/
│   │   └── v1/
│   │       └── users/
│   │           └── route.ts
│   └── layout.tsx
├── components/                   # UI 컴포넌트 (shadcn 등)
│   ├── ui/                       # shadcn 컴포넌트
│   └── features/                 # 기능별 컴포넌트
├── lib/                          # 유틸, 헬퍼 (서버/클라 공용)
│   ├── http/
│   ├── validation/
│   └── utils.ts
├── server/                       # 서버 전용 코드
│   ├── db/                       # Drizzle/Prisma 정의
│   ├── services/                 # 비즈니스 로직
│   ├── repositories/             # 데이터 접근
│   └── auth/
├── types/                        # 공통 타입
├── middleware.ts                 # 전역 미들웨어 (인증 등)
└── package.json
```

## 핵심 규칙

- **`server/` 에 들어가는 파일은 절대 클라이언트에 노출되지 않도록 주의**
- 파일 상단에 `'server-only'` import로 보호:
  ```typescript
  import 'server-only';
  export async function secretStuff() { ... }
  ```
- 반대로 클라이언트 전용은 `'client-only'`

## 레이어링

```
Route Handler / Server Action
          ↓
       Service        ← 비즈니스 로직
          ↓
     Repository       ← DB/외부 API 접근
          ↓
       DB / External
```

- **Route Handler에 비즈니스 로직 넣지 말 것** — 재사용·테스트 어려움
- **Service는 trans-action 단위 작업 조율**
- **Repository는 데이터 원천 하나에 매핑** (한 repo = 한 테이블 or 한 외부 API)

## ORM 선택

| 도구 | 장점 | 단점 |
|------|------|------|
| **Drizzle** | SQL-like, 타입 안전, 가벼움 | 마이그레이션 생태계 얕음 |
| **Prisma** | 성숙한 생태계, 풍부한 도구 | 런타임 비용, 번들 크기 |
| raw SQL + pg | 최대 유연성 | 직접 타입 매핑 |

Next.js + Edge 고려 시 **Drizzle 선호**. 서버리스에서 Prisma는 cold start 페널티 큼.

## Server Components vs Client Components 경계

- **기본은 Server Component** — `'use client'` 없으면 서버에서만 실행
- 상태·이벤트 핸들러·브라우저 API 필요할 때만 `'use client'`
- **서버 코드에서 Client Component 임포트 OK**
- **Client Component에서 Server Component 임포트는 children prop으로만**

## 데이터 페칭 패턴

### Server Component에서 직접 fetch

```tsx
// app/users/[id]/page.tsx
export default async function UserPage({ params }: { params: { id: string } }) {
  const user = await userService.findById(params.id);
  if (!user) notFound();
  return <UserProfile user={user} />;
}
```

- **`fetch`는 자동 캐싱**. 캐시 전략 명시:
  - `fetch(url, { cache: 'no-store' })` — 매 요청마다
  - `fetch(url, { next: { revalidate: 60 } })` — 60초마다 재검증
  - `fetch(url, { next: { tags: ['users'] } })` — 태그 기반 재검증

### 클라이언트 mutation 이후 재검증

```typescript
// 서버 액션 내
revalidatePath('/users');         // 경로 기반
revalidateTag('users');           // 태그 기반
```

## 설정 관리

- **환경별 분리**: `.env.local`, `.env.development`, `.env.production`
- **타입 안전 env**: `@t3-oss/env-nextjs` 권장
  ```typescript
  // env.ts
  export const env = createEnv({
    server: {
      DATABASE_URL: z.string().url(),
      JWT_SECRET: z.string().min(32),
    },
    client: {
      NEXT_PUBLIC_APP_URL: z.string().url(),
    },
    runtimeEnv: process.env,
  });
  ```

## TypeScript 설정

### `tsconfig.json` 핵심

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true
  }
}
```

- `strict: true`는 **타협 불가**
- `noUncheckedIndexedAccess`: `array[0]`가 `T | undefined`로 — 런타임 안전성 크게 향상

## 네이밍 컨벤션

| 종류 | 규칙 | 예 |
|------|------|---|
| 파일 | kebab-case | `user-service.ts` |
| 컴포넌트 파일 | PascalCase | `UserProfile.tsx` |
| 훅 파일 | `use-` 접두 + kebab | `use-current-user.ts` |
| 타입 | PascalCase | `type User`, `interface Session` |
| 상수 | UPPER_SNAKE | `MAX_FILE_SIZE` |
| route.ts | 고정 | `route.ts`, `page.tsx`, `layout.tsx` |

## Package.json 팁

```json
{
  "scripts": {
    "dev": "next dev --turbo",
    "build": "next build",
    "typecheck": "tsc --noEmit",
    "lint": "next lint",
    "test": "vitest",
    "test:e2e": "playwright test"
  }
}
```

- CI에서 `typecheck`, `lint`, `test`, `build` 순서로

## 의존성 관리

- **pnpm 권장** (디스크·속도·monorepo 친화)
- Exact 버전 고정: `"next": "15.0.3"` — `^`, `~` 피하기
- **Renovate/Dependabot**으로 주간 자동 업데이트 PR

## 금지 사항

- `any` 타입 남발
- 서버 비밀을 `NEXT_PUBLIC_*` 에 저장
- 클라이언트 컴포넌트에서 DB 직접 접근
- 데이터 fetching을 `useEffect`로 — Server Component 또는 React Query
- 절대 경로 import 뒤섞기 — `@/` 하나로 통일 (tsconfig `paths`)
