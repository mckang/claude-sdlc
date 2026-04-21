# Next.js TypeScript (Backend) — 보안 표준

**기준 버전**: Next.js 15 / NextAuth 5.x (Auth.js) 또는 Lucia
**최종 갱신**: 2026-04

## 인증 라이브러리 선택

| 라이브러리 | 권장 상황 |
|-----------|-----------|
| **Auth.js (NextAuth v5)** | OAuth 제공자 다수, 빠른 구축 |
| **Lucia** | 세션 기반, 세밀한 제어 필요 |
| **Clerk / Supabase Auth** | 외부 서비스 허용 시 |
| 자체 구현 | 비추천 — 보안 실수 위험 |

## 세션 전략

- **세션 기반**(쿠키에 세션 ID, 서버에 세션 저장) 기본
- JWT-in-cookie 쓸 거면 **HttpOnly + Secure + SameSite=Lax**
- `localStorage` 절대 사용 금지

```typescript
// 쿠키 설정 예
cookies().set('session', token, {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: 60 * 60 * 24 * 7,
  path: '/',
});
```

## 미들웨어로 인증 게이트

```typescript
// middleware.ts
import { NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
  const session = await getSessionFromCookie(req);
  
  if (req.nextUrl.pathname.startsWith('/dashboard') && !session) {
    return NextResponse.redirect(new URL('/login', req.url));
  }
  
  return NextResponse.next();
}

export const config = {
  matcher: ['/dashboard/:path*', '/api/v1/admin/:path*'],
};
```

- **미들웨어는 Edge 런타임** — DB 접근 제약. 세션 검증은 JWT 파싱 정도만

## Server Action 보안

Server Action은 공개 엔드포인트임을 기억:

```typescript
'use server';

export async function deleteProject(projectId: string) {
  const session = await requireAuth();                 // ① 인증
  const project = await projectRepo.findById(projectId);
  if (!project) throw new NotFoundError();
  if (project.ownerId !== session.userId) {           // ② 인가 (IDOR 방어)
    throw new ForbiddenError();
  }
  await projectRepo.delete(projectId);
}
```

## 입력 검증: Zod 필수

```typescript
const Schema = z.object({
  email: z.string().email(),
  age: z.number().int().min(0).max(120),
});

const parsed = Schema.safeParse(input);
if (!parsed.success) return problem(400, 'Validation Failed');
// parsed.data는 타입 안전
```

- **모든 경계**에서 검증: Route Handler body/query, Server Action FormData, 외부 API 응답

## CSRF

- Server Action은 **기본적으로 CSRF 보호** (Origin 헤더 검증)
- 커스텀 Route Handler에서 쿠키 기반 인증 쓰면 CSRF 방어 필요:
  - Double-submit cookie 패턴
  - 또는 SameSite=Lax + Origin 검증

## SQL 인젝션

- **Drizzle/Prisma 파라미터 바인딩** 사용 시 자동 방어
- Raw SQL 쓸 때는:
  ```typescript
  // ✅ OK
  sql`SELECT * FROM users WHERE email = ${email}`
  
  // ❌ 금지
  `SELECT * FROM users WHERE email = '${email}'`
  ```

## XSS

- React는 기본 이스케이프 — `dangerouslySetInnerHTML` 사용 시 DOMPurify 적용
- 사용자 입력을 URL에 그대로 붙이지 않기 (open redirect 방어)

## 비밀번호

- **Argon2id** 권장 (또는 bcrypt cost 12+)
- Node.js: `@node-rs/argon2` 또는 `bcrypt`
- **평문·MD5·SHA1 절대 금지**

## Rate Limiting

- **Upstash Ratelimit** + Redis (서버리스 친화)
  ```typescript
  import { Ratelimit } from '@upstash/ratelimit';
  const limiter = new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(10, '10 s') });
  const { success } = await limiter.limit(ip);
  if (!success) return problem(429, 'Too Many Requests');
  ```

## 환경변수

- **서버 전용**: `DATABASE_URL`, `JWT_SECRET`, `STRIPE_SECRET` 등
- **클라이언트**: `NEXT_PUBLIC_*` 접두사 있는 것만
- **실수 방지**: `@t3-oss/env-nextjs`로 런타임 검증

```typescript
// env.ts
const server = {
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
};
const client = {
  NEXT_PUBLIC_APP_URL: z.string().url(),
};
```

## CORS

API를 외부에서 호출하면:

```typescript
// app/api/v1/public/route.ts
export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      'Access-Control-Allow-Origin': 'https://partner.example.com',  // 화이트리스트
      'Access-Control-Allow-Methods': 'GET, POST',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
```

- `*` 프로덕션 금지

## 보안 헤더

`next.config.mjs`:

```javascript
async headers() {
  return [{
    source: '/:path*',
    headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
    ],
  }];
}
```

- **CSP(Content Security Policy)** 도 고려 (nonce 기반)

## 의존성 보안

- `pnpm audit` CI에 통합
- **Socket.dev, Snyk** 같은 도구로 악성 패키지 감지
- 주간 Renovate PR 검토

## 로그에 민감정보 금지

```typescript
// ❌ 금지
log.info({ user });                // password, token 포함 위험

// ✅ OK
log.info({ userId: user.id, email: user.email });
```

## 금지 사항

- 토큰을 `NEXT_PUBLIC_*` 이나 URL 쿼리에 노출
- Server Action에서 인증 체크 생략
- 에러 응답에 스택트레이스/SQL 메시지
- IDOR 방어 없는 리소스 접근 (`/users/123` 조회 시 소유 확인)
- `eval()`, `Function()` 생성자
