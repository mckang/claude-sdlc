# Frontend — 테스트 표준

**기준 버전**: Vitest 1.x / React Testing Library / Playwright 1.4x
**최종 갱신**: 2026-04

## 테스트 전략

| 레벨 | 도구 | 비율 |
|------|------|------|
| 단위 (순수 함수·훅) | Vitest | 30% |
| 컴포넌트 | Vitest + React Testing Library | 50% |
| E2E (핵심 플로우) | Playwright | 20% |

- Jest 대신 **Vitest** — TypeScript·ESM 네이티브, 속도 빠름

## 컴포넌트 테스트 원칙

### 사용자 관점 쿼리

```tsx
// ❌ 구현 디테일
screen.getByTestId('submit-btn');
container.querySelector('.btn-primary');

// ✅ 사용자 관점
screen.getByRole('button', { name: /제출/i });
screen.getByLabelText(/이메일/i);
```

우선순위: `getByRole` > `getByLabelText` > `getByText` > `getByTestId`

### 실제 사용 흐름: userEvent

```tsx
import userEvent from '@testing-library/user-event';

test('폼 제출', async () => {
  const user = userEvent.setup();
  render(<SignupForm onSubmit={mockSubmit} />);
  
  await user.type(screen.getByLabelText(/이메일/i), 'a@b.com');
  await user.type(screen.getByLabelText(/비밀번호/i), 'password123');
  await user.click(screen.getByRole('button', { name: /가입/i }));
  
  expect(mockSubmit).toHaveBeenCalledWith({ email: 'a@b.com', password: 'password123' });
});
```

- `fireEvent` 말고 **`userEvent`** — 실제 사용자 행동에 가까움
- `user.setup()` 을 test 내에서 호출

## 비동기 UI

```tsx
// ❌ 금지
await new Promise(r => setTimeout(r, 100));

// ✅ findBy*
const toast = await screen.findByText(/저장 완료/i);

// ✅ waitFor (조건 기반)
await waitFor(() => {
  expect(mockFn).toHaveBeenCalled();
});
```

## 네트워크 Mock: MSW (Mock Service Worker)

```typescript
// tests/mocks/handlers.ts
import { http, HttpResponse } from 'msw';

export const handlers = [
  http.get('/api/v1/users/:id', ({ params }) => {
    return HttpResponse.json({ id: params.id, name: 'Test User' });
  }),
  http.post('/api/v1/users', async ({ request }) => {
    const body = await request.json();
    if (body.email === 'exists@test.com') {
      return HttpResponse.json({ error: 'Duplicate' }, { status: 409 });
    }
    return HttpResponse.json({ id: 1, ...body }, { status: 201 });
  }),
];
```

- MSW 쓰면 **같은 mock을 브라우저·테스트·Storybook에서 공유**
- fetch/axios/ky 등 모두 인터셉트

## 훅 테스트

```tsx
import { renderHook, act } from '@testing-library/react';

test('useCounter', () => {
  const { result } = renderHook(() => useCounter(0));
  
  act(() => {
    result.current.increment();
  });
  
  expect(result.current.value).toBe(1);
});
```

- **상태 변경은 `act()` 안에서**
- 커스텀 훅이 있으면 훅 자체를 테스트하고, 컴포넌트는 훅을 mock

## Server Component 테스트

Server Component는 **async 함수**라 RTL로 바로 테스트 어려움. 전략:

1. **비즈니스 로직은 별도 함수로** → 단위 테스트
   ```tsx
   // ✅ 이렇게 분리
   export async function getUserData(id: string) { ... }
   
   export default async function Page({ params }) {
     const data = await getUserData(params.id);
     return <UserCard user={data} />;
   }
   ```
2. **UI는 클라이언트 컴포넌트로 떼서** 테스트 (`<UserCard>`)
3. **전체는 Playwright E2E로** 검증

## 접근성 테스트

```bash
pnpm add -D jest-axe @axe-core/react
```

```tsx
import { axe } from 'jest-axe';

test('접근성 위반 없음', async () => {
  const { container } = render(<MyPage />);
  const results = await axe(container);
  expect(results).toHaveNoViolations();
});
```

- CI에 포함해서 a11y 퇴보 방지

## E2E: Playwright

### 설정

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: 'auth.json' }, dependencies: ['setup'] },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
});
```

### 인증 재사용

```typescript
// e2e/auth.setup.ts
import { test as setup } from '@playwright/test';

setup('로그인', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel(/이메일/i).fill('test@example.com');
  await page.getByLabel(/비밀번호/i).fill('password');
  await page.getByRole('button', { name: /로그인/i }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: 'auth.json' });
});
```

### 핵심 플로우만 E2E로

- 가입·로그인
- 결제·주문
- 핵심 대시보드 렌더
- 접근 권한 경계

**너무 많은 E2E 금지** — 실행 시간 폭발, flaky 증가

## Visual Regression (선택)

- **Chromatic** (Storybook 연동) 또는 **Percy**
- 디자인 시스템 변경이 UI에 미치는 영향 감지
- 초기엔 불필요, 디자인 시스템 성숙해지면 도입

## Storybook (선택)

- 컴포넌트 단위 개발·문서화
- shadcn 컴포넌트들 Storybook에 올려두면 디자인 논의 용이
- Play function으로 인터랙션 테스트도 가능

## 커버리지

```bash
pnpm test --coverage
```

- 라인 70% 이상 목표
- 컴포넌트 파일, 훅 파일 위주
- 설정·타입 정의 파일은 제외

## CI 파이프라인

```yaml
- typecheck (tsc --noEmit)
- lint (next lint)
- unit test (vitest run)
- build (next build)
- e2e (playwright test, 주요 브라우저만)
```

## 금지 사항

- `data-testid` 남발 — 사용자 쿼리 먼저
- `setTimeout` 으로 비동기 대기
- 실제 외부 API 호출 — MSW로 격리
- `screen.debug()` PR에 포함 채로 머지
- Snapshot 테스트 과용 — 변경 감지에만 노이즈 많음
- `act()` 경고 무시
