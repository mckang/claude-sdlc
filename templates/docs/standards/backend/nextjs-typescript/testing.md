# Next.js TypeScript (Backend) — 테스트 표준

**기준 버전**: Next.js 15 / Vitest 1.x / Playwright 1.4x
**최종 갱신**: 2026-04

## 도구 선택

| 레벨 | 도구 | 용도 |
|------|------|------|
| 단위 | **Vitest** | 순수 함수, 서비스, 유틸 |
| 컴포넌트 | **Vitest + React Testing Library** | UI 컴포넌트 |
| 통합 (API) | **Vitest + Testcontainers** | Route Handler, Server Action |
| E2E | **Playwright** | 주요 사용자 플로우 |

- Jest가 아닌 **Vitest** 권장: Vite 기반 속도, TypeScript 네이티브, ESM 친화

## 단위 테스트

```typescript
// server/services/user-service.test.ts
import { describe, it, expect, vi } from 'vitest';
import { UserService } from './user-service';

describe('UserService', () => {
  it('이메일이 이미 존재하면 중복 에러', async () => {
    const repo = { findByEmail: vi.fn().mockResolvedValue({ id: 1 }) };
    const service = new UserService(repo as any);
    
    await expect(service.create({ email: 'a@b.com', ... }))
      .rejects.toThrow(DuplicateEmailError);
  });
});
```

- **의존성은 생성자 주입** (테스트하기 쉽게)
- **mock 최소화** — mock 많이 필요하면 설계 신호

## 컴포넌트 테스트

- **사용자 관점 쿼리**: `getByRole`, `getByLabelText` 우선. `getByTestId` 최후 수단.
- **실제 사용 흐름 재현**: `userEvent` 사용 (fireEvent 말고)

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

test('폼 제출 시 에러 표시', async () => {
  const user = userEvent.setup();
  render(<SignupForm />);
  
  await user.click(screen.getByRole('button', { name: /가입/i }));
  
  expect(await screen.findByText(/이메일은 필수/i)).toBeVisible();
});
```

## API 통합 테스트

Route Handler를 직접 호출:

```typescript
import { POST } from '@/app/api/v1/users/route';
import { NextRequest } from 'next/server';

test('POST /users', async () => {
  const req = new NextRequest('http://localhost/api/v1/users', {
    method: 'POST',
    body: JSON.stringify({ email: 'a@b.com', ... }),
  });
  
  const res = await POST(req);
  expect(res.status).toBe(201);
  expect(res.headers.get('location')).toMatch(/\/api\/v1\/users\//);
});
```

## DB는 Testcontainers로

```typescript
import { PostgreSqlContainer } from '@testcontainers/postgresql';

beforeAll(async () => {
  container = await new PostgreSqlContainer('postgres:16-alpine').start();
  process.env.DATABASE_URL = container.getConnectionUri();
  await runMigrations();
});
```

- SQLite 인메모리 금지 — Postgres 특화 기능(JSONB, CTE 등) 다름
- 테스트 간 격리: 매 테스트마다 트랜잭션 롤백 또는 truncate

## Server Action 테스트

```typescript
import { updateProfile } from '@/app/users/actions';

test('updateProfile', async () => {
  mockAuth({ userId: 'u1' });
  const formData = new FormData();
  formData.set('name', 'Alice');
  
  const result = await updateProfile(formData);
  expect(result.ok).toBe(true);
});
```

- 세션·인증은 `vi.mock()` 으로 격리

## E2E (Playwright)

- **인증 상태 저장** (`storageState`)로 로그인 반복 제거
- **병렬 실행** 기본값 유지
- **Trace viewer** 활용: `--trace=on-first-retry`

```typescript
// playwright.config.ts
export default defineConfig({
  use: { baseURL: 'http://localhost:3000', trace: 'on-first-retry' },
  projects: [
    { name: 'setup', testMatch: 'auth.setup.ts' },
    { name: 'chromium', use: { ...devices['Desktop Chrome'], storageState: 'auth.json' }, dependencies: ['setup'] },
  ],
});
```

## 테스트 데이터

- **빌더/팩토리 함수** (`fishery`, `@faker-js/faker`)
- 시드 고정해서 재현 가능하게

## 커버리지

- **Vitest + c8**: `pnpm test --coverage`
- 목표 70%+ 라인, 의미 있는 분기 위주
- DTO·스키마 파일은 제외

## CI 전략

```yaml
# 예시
- typecheck
- lint
- unit test (병렬)
- integration test (Testcontainers)
- build
- E2E (Playwright, 주요 브라우저만)
```

## 금지 사항

- `setTimeout`/`sleep`으로 비동기 대기 — `waitFor`, `findBy*` 사용
- 실제 외부 API 호출 (OpenAI, Stripe 등) — MSW로 mock
- 테스트 간 상태 공유
- 프로덕션 `.env` 로 테스트 실행
