# Next.js TypeScript (Backend) — 옵저버빌리티 표준

**기준 버전**: Next.js 15 / OpenTelemetry / pino
**최종 갱신**: 2026-04

## 로깅

### 도구: pino (Node.js 표준)

구조화 JSON 로깅:

```typescript
// lib/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: ['password', 'token', '*.password', '*.token', 'authorization'],
});
```

- `redact`로 민감 필드 자동 마스킹

### 로그 레벨

| 레벨 | 용도 |
|------|------|
| `error` | 조치 필요 오류 |
| `warn` | 재시도 성공, 설정 누락 fallback |
| `info` | 주요 비즈니스 이벤트 (가입, 주문) |
| `debug` | 개발 트러블슈팅 |

### 요청별 컨텍스트

```typescript
// middleware나 Route Handler 시작에서
const requestLogger = logger.child({
  requestId: crypto.randomUUID(),
  userId: session?.userId,
  path: req.nextUrl.pathname,
});
```

## OpenTelemetry 계측

```typescript
// instrumentation.ts (Next.js 15 표준)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('./instrumentation.node');
  }
}
```

```typescript
// instrumentation.node.ts
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  serviceName: 'my-app',
  instrumentations: [getNodeAutoInstrumentations()],
});
sdk.start();
```

- HTTP, DB, fetch 자동 계측됨
- OTLP exporter로 Jaeger·Tempo·Datadog 등에 전송

## 메트릭

### Next.js 특화 메트릭

- 요청 레이턴시 (p50, p95, p99)
- 에러율
- 캐시 히트율 (`fetch` cache, ISR)
- Server Component 렌더 시간
- 외부 API 호출 시간·실패율

### Prometheus 노출

```typescript
// app/api/metrics/route.ts
import { register } from 'prom-client';

export async function GET() {
  return new Response(await register.metrics(), {
    headers: { 'content-type': register.contentType },
  });
}
```

- 이 엔드포인트는 **내부 네트워크에서만** 접근 (미들웨어로 IP 제한 or 인증)

### 커스텀 비즈니스 메트릭

```typescript
import { Counter, Histogram } from 'prom-client';

export const ordersCreated = new Counter({
  name: 'orders_created_total',
  help: '생성된 주문 수',
  labelNames: ['source'] as const,
});

// 사용
ordersCreated.inc({ source: 'web' });
```

- **라벨 카디널리티 주의**: `userId` 같은 고유값 금지

## 에러 트래킹

### Sentry 연동 (권장)

```bash
pnpm add @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

- 자동으로 Route Handler, Server Component, Client 에러 수집
- Source map 업로드로 스택트레이스 읽기 쉽게
- **PII 스크러빙** 설정 필수

```typescript
// sentry.server.config.ts
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // PII 제거
    delete event.user?.email;
    return event;
  },
});
```

## Health Check

```typescript
// app/api/health/route.ts
export const dynamic = 'force-dynamic';

export async function GET() {
  return Response.json({ status: 'ok', timestamp: Date.now() });
}

// app/api/health/ready/route.ts
export async function GET() {
  const checks = await Promise.allSettled([
    db.execute('SELECT 1'),
    redis.ping(),
  ]);
  
  const allOk = checks.every(c => c.status === 'fulfilled');
  return Response.json(
    { status: allOk ? 'ok' : 'degraded', checks },
    { status: allOk ? 200 : 503 }
  );
}
```

- **liveness**: 프로세스 살아있는지만 (DB 체크 X)
- **readiness**: 외부 의존성까지 확인

## Core Web Vitals (프론트 지표)

- `web-vitals` 라이브러리로 클라이언트 수집
- Next.js에는 `reportWebVitals` 훅 내장
- LCP, FID, CLS, INP 추적 → Analytics 전송

## Vercel 특화

- Vercel 사용 시 **Vercel Analytics**, **Speed Insights** 기본 제공
- 로그 보관 주기 짧음 (Hobby: 1시간) → 외부 로그 드레인 설정 필요

## 금지 사항

- `console.log` 프로덕션 — `logger` 사용
- 에러 삼키기 (`catch (e) {}`) — 최소한 로깅
- 메트릭 라벨에 고유 ID
- 로그·트레이스에 비밀번호·토큰 (redact 설정으로 방어)
- 프로덕션에서 verbose 레벨 로깅
