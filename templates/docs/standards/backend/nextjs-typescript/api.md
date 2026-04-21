# Next.js TypeScript (Backend) — API 표준

**기준 버전**: Next.js 15 (App Router) / TypeScript 5.x
**최종 갱신**: 2026-04

> 이 문서는 Next.js의 **Route Handlers**(`app/api/**/route.ts`)와 **Server Actions**를 사용한 백엔드 기능에 관한 것. 단순 프론트엔드 규칙은 `docs/standards/frontend/nextjs.md` 참조.

## Route Handler vs Server Action 선택

| 상황 | 선택 |
|------|------|
| 외부 호출, 3rd party 통합 | Route Handler (`app/api/.../route.ts`) |
| 폼 제출, 내부 mutation | **Server Action** 선호 (타입 안전·간결) |
| 공개 API | Route Handler |
| 파일 업로드/다운로드 | Route Handler |
| 모바일 앱과 공유할 API | Route Handler |

## Route Handler 기본 구조

```typescript
// app/api/v1/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const CreateUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1).max(100),
});

export async function POST(req: NextRequest) {
  const body = await req.json();
  const parsed = CreateUserSchema.safeParse(body);
  
  if (!parsed.success) {
    return problem(400, 'Validation Failed', parsed.error.issues);
  }
  
  const user = await userService.create(parsed.data);
  return NextResponse.json(user, { 
    status: 201, 
    headers: { Location: `/api/v1/users/${user.id}` } 
  });
}
```

## URI 설계

- `/api/v1/users`, `/api/v1/orders` — 복수형 명사
- 버전 prefix 필수 (`/api/v1/...`)
- 동적 라우트: `/api/v1/users/[id]/route.ts`
- **Next.js에서 조심할 것**: route.ts는 파일 이름이 정해져 있으므로 폴더 구조로 URI 표현

## 입력 검증: Zod 필수

- **모든 외부 입력**(body, query, params)은 Zod로 검증
- 타입과 런타임 검증을 **한 번에** (TypeScript 타입만으로는 런타임 안전성 없음)

```typescript
// 쿼리 파라미터
const QuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const result = QuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!result.success) return problem(400, 'Invalid query');
  // result.data.page는 number로 타입 보장
}
```

## 응답 포맷

### 성공
- 단건: `NextResponse.json(user, { status: 200 })`
- 생성: `NextResponse.json(user, { status: 201, headers: { Location: ... } })`
- 삭제: `new NextResponse(null, { status: 204 })`

### 에러: RFC 7807 Problem Details

```typescript
// lib/http/problem.ts
export function problem(
  status: number,
  title: string,
  detail?: unknown,
): NextResponse {
  return NextResponse.json(
    {
      type: `https://api.example.com/errors/${title.toLowerCase().replace(/ /g, '-')}`,
      title,
      status,
      detail,
      instance: crypto.randomUUID(),
    },
    { status, headers: { 'content-type': 'application/problem+json' } }
  );
}
```

## Server Actions

```typescript
// app/users/actions.ts
'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';

const Schema = z.object({
  name: z.string().min(1),
});

export async function updateProfile(formData: FormData) {
  const session = await requireAuth();  // 인증 확인
  const parsed = Schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.flatten() };
  }
  
  await userService.update(session.userId, parsed.data);
  revalidatePath('/profile');
  return { ok: true };
}
```

- **반드시 인증/인가 체크** — Server Action은 공개 엔드포인트처럼 호출 가능
- `'use server'` 디렉티브 파일에 **비밀키 사용 주의** — 해당 파일이 번들에 포함되지 않아도, 호출은 클라이언트가 트리거함
- 결과는 `{ ok: true | false, errors?: ... }` 같은 **Discriminated Union** 권장

## 멱등성

- 결제·주문 같은 중요 POST는 **Idempotency-Key 헤더**
- Redis에 `idempotency:{key}` TTL 24h 로 결과 캐싱

```typescript
export async function POST(req: NextRequest) {
  const idempotencyKey = req.headers.get('idempotency-key');
  if (idempotencyKey) {
    const cached = await redis.get(`idempotency:${idempotencyKey}`);
    if (cached) return NextResponse.json(JSON.parse(cached));
  }
  // ... 처리
}
```

## 페이지네이션

- **cursor 기반 선호**:
  ```json
  { "items": [...], "nextCursor": "eyJpZCI6MTIzfQ==" }
  ```
- offset은 정적 관리 화면에만

## 파일 업로드

- **작은 파일 (~5MB)**: Route Handler에 직접
- **큰 파일**: **Presigned URL** 발급 → 클라이언트가 S3 등에 직접 업로드
  - 왜: Node.js 서버리스 함수는 바디 크기 제한 있고, 메모리 낭비

## 에지 런타임 vs Node 런타임

- 기본 Node 런타임 유지
- **Edge 런타임**이 맞는 경우: 지역 분산이 중요한 단순 API (지연 민감), 데이터베이스 직접 접근 없음
- **Edge의 제약**: Node.js API 일부 사용 불가(`fs`, `crypto`의 일부), 패키지 호환성 문제 — PR에서 확인

## 환경 변수 접근

- 서버 전용: `process.env.SECRET_KEY` (파일이 `'use server'` 또는 route.ts)
- 클라이언트 노출: `NEXT_PUBLIC_*` 로 시작하는 것만
- **API 키·DB URL은 절대 `NEXT_PUBLIC_` 접두사 붙이지 말 것** — 브라우저 번들에 포함됨

## 금지 사항

- Route Handler에 비즈니스 로직 덩어리 — 서비스/도메인 모듈로 분리
- `@ts-ignore`, `any` 남발 — 불가피하면 주석으로 이유 명시
- 쿼리 파라미터에 비밀정보
- 프로덕션에서 `console.log` — 구조화 로깅(`pino` 등) 사용
- 응답 바디에 스택트레이스
