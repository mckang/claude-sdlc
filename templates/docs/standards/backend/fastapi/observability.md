# FastAPI — 옵저버빌리티 표준

**기준 버전**: FastAPI 0.110+ / OpenTelemetry / structlog
**최종 갱신**: 2026-04

## 로깅: structlog

```python
# app/logging.py
import structlog
import logging

structlog.configure(
    processors=[
        structlog.contextvars.merge_contextvars,
        structlog.processors.add_log_level,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer(),
    ],
    wrapper_class=structlog.stdlib.BoundLogger,
    logger_factory=structlog.stdlib.LoggerFactory(),
)
logging.basicConfig(level=logging.INFO)

log = structlog.get_logger()
```

- **JSON 구조화** 로깅 (ELK/Loki/Datadog 친화)
- `contextvars` 로 요청 단위 컨텍스트 전파

## 요청 컨텍스트 주입

```python
from uuid import uuid4
from starlette.middleware.base import BaseHTTPMiddleware
import structlog

class RequestContextMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        request_id = request.headers.get("x-request-id") or str(uuid4())
        structlog.contextvars.clear_contextvars()
        structlog.contextvars.bind_contextvars(
            request_id=request_id,
            path=request.url.path,
            method=request.method,
        )
        response = await call_next(request)
        response.headers["X-Request-Id"] = request_id
        return response
```

## 로그 레벨

| 레벨 | 용도 |
|------|------|
| ERROR | 조치 필요 오류 |
| WARNING | 재시도 성공, fallback |
| INFO | 비즈니스 이벤트 |
| DEBUG | 개발 트러블슈팅 |

```python
log.info("user_created", user_id=user.id, email=user.email)
log.error("payment_failed", order_id=order.id, error=str(e))
```

- 키-값 쌍으로 기록 — 검색·집계 쉽게

## OpenTelemetry

```python
# app/tracing.py
from opentelemetry import trace
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor
from opentelemetry.exporter.otlp.proto.grpc.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.instrumentation.sqlalchemy import SQLAlchemyInstrumentor
from opentelemetry.instrumentation.httpx import HTTPXClientInstrumentor

def setup_tracing(app):
    provider = TracerProvider()
    provider.add_span_processor(BatchSpanProcessor(OTLPSpanExporter()))
    trace.set_tracer_provider(provider)
    
    FastAPIInstrumentor.instrument_app(app)
    SQLAlchemyInstrumentor().instrument(engine=engine)
    HTTPXClientInstrumentor().instrument()
```

- **샘플링**: 프로덕션 1-10%, 개발 100%
- HTTP·DB·외부 호출 자동 계측

### 수동 스팬

```python
tracer = trace.get_tracer(__name__)

async def calculate_discount(order: Order) -> Money:
    with tracer.start_as_current_span("calculate_discount") as span:
        span.set_attribute("order.id", order.id)
        span.set_attribute("order.amount", order.total_amount)
        # ... 로직
        return discount
```

## 메트릭: prometheus-client

```python
from prometheus_client import Counter, Histogram, make_asgi_app

orders_created = Counter(
    "orders_created_total",
    "생성된 주문 수",
    ["source"],
)

checkout_duration = Histogram(
    "checkout_duration_seconds",
    "체크아웃 소요 시간",
    buckets=(0.1, 0.5, 1.0, 2.5, 5.0, 10.0),
)

# /metrics 엔드포인트
metrics_app = make_asgi_app()
app.mount("/metrics", metrics_app)
```

### HTTP 메트릭 자동 수집

- **starlette-prometheus** 또는 **prometheus-fastapi-instrumentator**
  ```python
  from prometheus_fastapi_instrumentator import Instrumentator
  Instrumentator().instrument(app).expose(app)
  ```

### 카디널리티 규칙

- 라벨에 `user_id`, `request_id` 같은 고유값 **금지**
- 라벨은 낮은 카디널리티(상태·타입·리전)만

## Health Check

```python
@app.get("/health/live", include_in_schema=False)
async def liveness():
    return {"status": "ok"}

@app.get("/health/ready", include_in_schema=False)
async def readiness(db: AsyncSession = Depends(get_db)):
    checks = {}
    try:
        await db.execute(text("SELECT 1"))
        checks["db"] = "ok"
    except Exception as e:
        checks["db"] = f"fail: {e}"
    
    all_ok = all(v == "ok" for v in checks.values())
    return JSONResponse(
        {"status": "ok" if all_ok else "degraded", "checks": checks},
        status_code=200 if all_ok else 503,
    )
```

## 에러 트래킹

**Sentry** 통합:

```python
import sentry_sdk
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration

sentry_sdk.init(
    dsn=settings.sentry_dsn,
    traces_sample_rate=0.1,
    integrations=[FastApiIntegration(), SqlalchemyIntegration()],
    before_send=scrub_pii,  # PII 제거
)
```

## 액세스 로그

Uvicorn 기본 액세스 로그는 텍스트 — JSON 변환:

```python
# logging_config.py 로 uvicorn.access 로거 포맷 JSON 지정
# 또는 ASGI 미들웨어로 직접 로깅
```

## 비즈니스 이벤트 로깅

```python
# 중요 이벤트는 반드시 로그
log.info("order_completed", order_id=order.id, total=order.total, user_id=order.user_id)
log.info("payment_captured", provider="stripe", amount=amount, order_id=order_id)
log.warning("rate_limit_exceeded", client_ip=ip, endpoint=path)
```

- 비즈니스 이벤트는 **INFO** (DEBUG 아님) — 프로덕션에서도 보여야 함

## 의존 서비스 호출 계측

```python
# httpx 자동 계측 + 수동 태그
async with tracer.start_as_current_span("stripe_charge") as span:
    span.set_attribute("stripe.customer_id", customer_id)
    response = await httpx_client.post("https://api.stripe.com/...")
    span.set_attribute("http.status_code", response.status_code)
```

## 금지 사항

- `print()` 로 로깅 — structlog/logger 사용
- 예외 삼키기 — 최소 로깅
- 메트릭 라벨 고유값 폭발
- 민감 정보(비밀번호, 토큰, PII)를 로그에
- 모든 요청 DEBUG 레벨 로깅 (디스크 폭발)
