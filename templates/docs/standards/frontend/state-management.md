# Frontend — 상태 관리 표준

**기준 버전**: Next.js 15 / React 19 / TanStack Query 5 / Zustand 4
**최종 갱신**: 2026-04

## 상태의 4가지 종류 구분

| 종류 | 예 | 도구 |
|------|-----|------|
| **서버 상태** | 사용자 프로필, 상품 목록 | Server Component, TanStack Query, SWR |
| **URL 상태** | 탭, 필터, 페이지 | `useSearchParams`, path params |
| **폼 상태** | 입력 중인 값 | react-hook-form |
| **UI 상태** | 모달 열림, 토글 | `useState`, Zustand |

**서버 상태를 Redux/Zustand에 저장하지 말 것** — 동기화 지옥.

## 서버 상태 (핵심)

### Server Component로 시작

```tsx
// 가장 단순한 접근
export default async function UserPage() {
  const user = await userService.findById('me');
  return <UserProfile user={user} />;
}
```

- 초기 로딩엔 추가 상태 관리 도구 불필요
- SEO·LCP·번들 크기 모두 유리

### 클라이언트에서 재페칭 필요할 때: TanStack Query

```tsx
'use client';
import { useQuery } from '@tanstack/react-query';

export function Notifications() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => fetch('/api/v1/notifications').then(r => r.json()),
    staleTime: 30_000,
  });
  
  if (isLoading) return <Skeleton />;
  if (error) return <Error />;
  if (!data?.length) return <Empty />;
  return <List items={data} />;
}
```

언제 TanStack Query 필요한가:
- 폴링·실시간 업데이트
- 여러 컴포넌트가 같은 데이터 공유
- 낙관적 업데이트
- 무한 스크롤

### QueryClient 전역 설정

```tsx
// app/providers.tsx
'use client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        retry: 1,
      },
    },
  }));
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
```

- **`useState`로 생성** — SSR 시 매 요청마다 새 인스턴스

## URL 상태

**페이지 상태는 URL에** — 공유·북마크·새로고침 시 보존:

```tsx
'use client';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';

export function SearchBar() {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  
  const q = params.get('q') ?? '';
  
  function onChange(value: string) {
    const next = new URLSearchParams(params);
    if (value) next.set('q', value);
    else next.delete('q');
    router.push(`${pathname}?${next.toString()}`);
  }
  
  return <Input value={q} onChange={(e) => onChange(e.target.value)} />;
}
```

- **nuqs** 라이브러리 활용하면 타입 안전 + 훨씬 간결
  ```tsx
  const [q, setQ] = useQueryState('q');
  ```

## 폼 상태: react-hook-form

```tsx
'use client';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';

const schema = z.object({ ... });

export function MyForm() {
  const form = useForm({ resolver: zodResolver(schema) });
  return <form onSubmit={form.handleSubmit(onSubmit)}>...</form>;
}
```

- **`useState`로 input value 관리 금지** — 성능·검증 모두 손해
- **Zod** 로 스키마 공유 (서버 액션과 동일한 스키마)

## UI 상태

### 로컬: `useState`

```tsx
const [open, setOpen] = useState(false);
```

### 전역(페이지 내): Context

```tsx
// 테마, 사이드바 토글 등 작은 전역
const ThemeContext = createContext(...);
```

### 전역(크로스 페이지): Zustand

```tsx
// stores/cart.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CartState {
  items: CartItem[];
  add: (item: CartItem) => void;
  clear: () => void;
}

export const useCart = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      add: (item) => set((s) => ({ items: [...s.items, item] })),
      clear: () => set({ items: [] }),
    }),
    { name: 'cart' }
  )
);
```

- **Redux는 피하기** (보일러플레이트 vs Zustand) — 팀 경험에 따라
- Zustand로도 DevTools, persist, immer 다 가능

### Zustand 안티패턴

- 서버 상태를 Zustand에 저장 (TanStack Query로)
- 폼 상태를 Zustand에 (react-hook-form)
- 전체 앱을 하나의 스토어로 — 도메인별 분리

## 낙관적 업데이트

```tsx
const mutation = useMutation({
  mutationFn: updateTodo,
  onMutate: async (newTodo) => {
    await queryClient.cancelQueries({ queryKey: ['todos'] });
    const previous = queryClient.getQueryData(['todos']);
    queryClient.setQueryData(['todos'], (old) => [...old, newTodo]);
    return { previous };
  },
  onError: (err, vars, context) => {
    queryClient.setQueryData(['todos'], context.previous);
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['todos'] });
  },
});
```

- 실패 시 롤백 로직 반드시 포함

## React 19의 `use` Hook

Server → Client로 promise 전달 가능:

```tsx
// Server Component
export default function Page() {
  const postsPromise = fetchPosts();  // await 안 함
  return (
    <Suspense fallback={<Skeleton />}>
      <PostList postsPromise={postsPromise} />
    </Suspense>
  );
}

// Client Component
'use client';
import { use } from 'react';

export function PostList({ postsPromise }) {
  const posts = use(postsPromise);  // Suspend까지
  return ...;
}
```

## 주의: `'use client'` 경계

- Client Component 안에서는 Server Component 직접 import 불가
- 대신 **`children` 패턴**으로:
  ```tsx
  'use client';
  export function ClientWrapper({ children }: { children: React.ReactNode }) {
    return <>{children}</>;
  }
  
  // 사용
  <ClientWrapper>
    <ServerComponent />
  </ClientWrapper>
  ```

## 금지 사항

- 서버 데이터를 Zustand/Redux에 저장 → 동기화 지옥
- `useEffect` 로 데이터 페칭 (Server Component or TanStack Query)
- 모든 상태를 전역화 — 로컬로 시작, 필요할 때만 올림
- 여러 `useState` 로 관련 상태 쪼개기 (하나의 객체나 reducer로)
- 폼 input을 `useState`로 관리 (리렌더 폭발)
- Context 하나에 자주 바뀌는 여러 값 — 전체 리렌더
