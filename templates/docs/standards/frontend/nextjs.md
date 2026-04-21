# Frontend — Next.js 표준

**기준 버전**: Next.js 15 (App Router) / React 19
**최종 갱신**: 2026-04

## App Router 기본 원칙

- **기본은 Server Component** — `'use client'` 없으면 서버에서만 실행, 번들 포함 X
- 상호작용·브라우저 API·상태 필요할 때만 `'use client'`
- **Client Component는 잎(leaf)에 가깝게** — 상위가 클라이언트면 하위 서버 컴포넌트 쓸 수 없음

## 파일 규약

| 파일 | 역할 |
|------|------|
| `page.tsx` | 라우트 (URL에 노출) |
| `layout.tsx` | 레이아웃 (자식 감싸기) |
| `loading.tsx` | Suspense fallback |
| `error.tsx` | Error Boundary (클라이언트) |
| `not-found.tsx` | 404 페이지 |
| `route.ts` | API endpoint (Route Handler) |
| `template.tsx` | 매번 새로 마운트되는 레이아웃 |

## 라우팅 패턴

### Route Group
괄호 폴더는 URL에 안 나옴 — 레이아웃·조직용:
```
app/
├── (marketing)/          # URL: /
│   ├── layout.tsx
│   └── page.tsx
├── (app)/                # URL: /
│   ├── layout.tsx        # 인증 필요
│   └── dashboard/page.tsx
```

### Parallel Route
`@` 접두로 동시에 여러 슬롯:
```
app/
├── layout.tsx            # children, modal 둘 다 받음
├── @modal/
│   └── login/page.tsx    # /login 접근 시 modal 렌더
└── page.tsx
```

### Intercepting Route (모달 패턴 등)
`(.)`, `(..)`, `(...)` 로 다른 경로를 인터셉트.

## 데이터 페칭

### Server Component에서 직접

```tsx
// app/products/page.tsx
export default async function ProductsPage() {
  const products = await db.query.products.findMany();
  return <ProductList products={products} />;
}
```

- **useEffect로 페칭 금지** — Server Component에서 처리

### 캐싱 제어 (fetch)

```typescript
// 기본: 캐시됨 (static)
fetch(url);

// 캐시 안 함 (매 요청)
fetch(url, { cache: 'no-store' });

// N초마다 재검증 (ISR)
fetch(url, { next: { revalidate: 60 } });

// 태그 기반 재검증
fetch(url, { next: { tags: ['products'] } });
// 이후 revalidateTag('products') 호출하면 무효화
```

### 병렬 페칭

```tsx
export default async function Page() {
  // 병렬
  const [user, posts] = await Promise.all([
    getUser(),
    getPosts(),
  ]);
  
  // 직렬 (의존성 있을 때만)
  const profile = await getProfile();
  const friends = await getFriends(profile.id);
}
```

## Suspense와 Streaming

```tsx
import { Suspense } from 'react';

export default function Page() {
  return (
    <>
      <Header />  {/* 즉시 */}
      <Suspense fallback={<Skeleton />}>
        <SlowContent />  {/* 나중에 스트리밍 */}
      </Suspense>
    </>
  );
}
```

- 느린 부분을 Suspense로 감싸면 **HTML 스트리밍** → TTFB 개선
- `loading.tsx` 파일이 자동 Suspense 역할

## Loading / Empty / Error 상태

모든 비동기 UI는 **4가지 상태 모두** 처리:

```tsx
export default async function ProductsPage() {
  const products = await getProducts();
  
  if (products.length === 0) {
    return <EmptyState message="상품이 없습니다" />;
  }
  
  return <ProductList products={products} />;
}

// error.tsx
'use client';
export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  return (
    <div>
      <h2>문제가 발생했습니다</h2>
      <button onClick={reset}>다시 시도</button>
    </div>
  );
}
```

## Mutation: Server Action

```tsx
// app/todos/actions.ts
'use server';

import { revalidatePath } from 'next/cache';

export async function createTodo(formData: FormData) {
  const session = await requireAuth();
  const title = formData.get('title') as string;
  
  await db.insert(todos).values({ title, userId: session.userId });
  revalidatePath('/todos');
}

// app/todos/page.tsx
export default function TodosPage() {
  return (
    <form action={createTodo}>
      <input name="title" />
      <button type="submit">추가</button>
    </form>
  );
}
```

- **useActionState** (React 19) 로 폼 제출 상태·에러 처리:
  ```tsx
  'use client';
  import { useActionState } from 'react';
  
  export function TodoForm() {
    const [state, formAction, pending] = useActionState(createTodo, null);
    return (
      <form action={formAction}>
        <input name="title" />
        <button disabled={pending}>{pending ? '처리중...' : '추가'}</button>
        {state?.error && <p>{state.error}</p>}
      </form>
    );
  }
  ```

## 이미지 최적화

```tsx
import Image from 'next/image';

<Image 
  src="/hero.jpg" 
  alt="Hero" 
  width={1200} 
  height={600}
  priority  // LCP 후보면 priority
/>
```

- `next/image` 사용 — 자동 lazy, 포맷 변환, 사이즈 최적화
- **반드시 `alt`** (접근성 + LCP)
- 원격 이미지는 `next.config.mjs` 의 `remotePatterns` 허용

## 폰트

```tsx
// app/layout.tsx
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], display: 'swap' });

export default function RootLayout({ children }) {
  return <html lang="ko" className={inter.className}>{children}</html>;
}
```

- `next/font` — 자동 셀프 호스팅, 레이아웃 쉬프트 방지

## 메타데이터 (SEO)

```tsx
// page.tsx 또는 layout.tsx
export const metadata: Metadata = {
  title: '제품 목록',
  description: '...',
  openGraph: { ... },
};

// 동적 메타데이터
export async function generateMetadata({ params }): Promise<Metadata> {
  const product = await getProduct(params.id);
  return { title: product.name };
}
```

## 국제화(i18n)

- Next.js 기본 i18n 라우팅 + **next-intl** 라이브러리 권장
- 서버·클라이언트 일관된 메시지 관리

## 성능

- **동적 import**: `next/dynamic` 로 큰 컴포넌트 지연 로드
  ```tsx
  const Chart = dynamic(() => import('./Chart'), { ssr: false });
  ```
- **`'use client'` 남발 금지** — 번들 크기 직결
- `<Link>` 의 prefetch 활용 (기본 활성)

## 금지 사항

- 데이터 페칭을 `useEffect`로 (Server Component로 해결)
- Server Component에서 `useState`, 이벤트 핸들러
- 모든 컴포넌트 `'use client'` 처리 (번들 폭발)
- 환경변수 `NEXT_PUBLIC_*` 에 비밀키
- `<img>` 대신 `<Image>` 안 쓰기 (성능 저하)
- `loading.tsx`, `error.tsx` 생략 — 사용자 경험 나빠짐
