# Spring Boot — 옵저버빌리티 표준

**기준 버전**: Spring Boot 3.x / Micrometer 1.12+ / OpenTelemetry
**최종 갱신**: 2026-04

## 3가지 축: Logs, Metrics, Traces

| 축 | 질문 | 도구 |
|----|------|------|
| Logs | 무엇이 일어났나 | SLF4J + Logback + JSON 포맷 |
| Metrics | 얼마나 자주, 얼마나 | Micrometer → Prometheus |
| Traces | 어디서 느렸나 | Micrometer Tracing → OTLP |

세 축을 **trace id로 연결**해야 진짜 가치가 나옴.

## 로깅

### 구조화 로깅 필수

텍스트 로그는 검색·집계 불가. **JSON 포맷**으로:

```xml
<!-- logback-spring.xml -->
<configuration>
    <springProfile name="prod">
        <appender name="STDOUT" class="ch.qos.logback.core.ConsoleAppender">
            <encoder class="net.logstash.logback.encoder.LogstashEncoder"/>
        </appender>
    </springProfile>
</configuration>
```

### 로그 레벨 가이드

| 레벨 | 용도 | 예 |
|------|------|-----|
| ERROR | 조치가 필요한 오류 | DB 연결 실패, 외부 API 5xx |
| WARN | 즉시 문제는 아니지만 주의 | 재시도 발생, 설정 누락 fallback |
| INFO | 주요 비즈니스 이벤트 | 사용자 가입, 주문 생성 |
| DEBUG | 개발·트러블슈팅용 | 분기 선택, 중간 계산값 |
| TRACE | 매우 상세 | 루프 내부, 라이브러리 내부 |

### MDC로 컨텍스트 주입

요청 단위 식별자를 모든 로그에 자동 포함:

```java
@Component
public class MdcFilter extends OncePerRequestFilter {
    @Override
    protected void doFilterInternal(HttpServletRequest req, ...) {
        MDC.put("traceId", getOrGenerateTraceId(req));
        MDC.put("userId", getCurrentUserId());
        try { chain.doFilter(req, res); }
        finally { MDC.clear(); }
    }
}
```

- Spring Cloud Sleuth / Micrometer Tracing 쓰면 `traceId`·`spanId` 자동 주입

### 로깅 금지 사항

- **비밀번호, 토큰, 카드번호, 주민번호** 로그에 금지
- `toString()`으로 엔티티 통째로 찍기 금지 (민감 필드 노출)
- 루프 안에서 INFO 이상 레벨 로깅 (볼륨 폭발)
- `e.printStackTrace()` — `log.error("msg", e)` 사용

## 메트릭

### Spring Boot Actuator + Micrometer

```yaml
management:
  endpoints.web.exposure.include: health,metrics,prometheus
  endpoint.health.probes.enabled: true
  metrics.tags:
    application: ${spring.application.name}
    env: ${ENVIRONMENT}
```

### 필수 메트릭

| 카테고리 | 메트릭 |
|----------|--------|
| HTTP | `http.server.requests` (자동, RED: Rate/Errors/Duration) |
| DB | `hikaricp.connections.*`, JPA 쿼리 시간 |
| JVM | heap, GC, threads (자동) |
| 비즈니스 | 주문 수, 결제 성공률, 가입 수 등 **커스텀 메트릭** |

### 커스텀 메트릭

```java
@Component
class OrderMetrics {
    private final Counter ordersCreated;
    private final Timer checkoutDuration;
    
    OrderMetrics(MeterRegistry registry) {
        this.ordersCreated = Counter.builder("orders.created")
            .tag("source", "web")
            .register(registry);
        this.checkoutDuration = Timer.builder("checkout.duration")
            .register(registry);
    }
}
```

- **태그 카디널리티 주의**: `userId` 같은 고유값을 태그로 쓰면 메트릭 폭발. 태그는 낮은 카디널리티(상태·타입·리전)만

## 분산 추적

### Micrometer Tracing (Spring Boot 3)

```gradle
implementation("io.micrometer:micrometer-tracing-bridge-otel")
implementation("io.opentelemetry:opentelemetry-exporter-otlp")
```

```yaml
management:
  tracing:
    sampling.probability: 0.1  # 프로덕션 10%, 개발 1.0
otel:
  exporter.otlp.endpoint: http://otel-collector:4317
```

### 스팬 추가가 필요한 지점

- 외부 HTTP 호출 (자동으로 되지만 attribute 추가)
- DB 쿼리 (자동)
- 메시지 발행/소비 (수동 계측 필요)
- 비동기 경계 (`@Async`, CompletableFuture)

### 수동 스팬 예:
```java
@Observed(name = "order.calculate_discount")
public Money calculateDiscount(Order order) { ... }
```

## Health Check

- **Liveness**: 프로세스 살아있는지 (`/actuator/health/liveness`)
- **Readiness**: 트래픽 받을 준비 됐는지 (`/actuator/health/readiness`)
- **외부 의존성은 Readiness에만** 포함 — Liveness에 넣으면 DB 잠깐 끊겨도 재시작됨

```java
@Component
class DatabaseHealthIndicator implements HealthIndicator {
    @Override
    public Health health() {
        // 실제로 쿼리 한 번 날려봄
    }
}
```

## 에러 트래킹

- **Sentry** 또는 **Rollbar** 같은 도구 연동
- `@RestControllerAdvice`에서 예외 → Sentry 전송 + ProblemDetail 응답
- 사용자·요청 컨텍스트 첨부

## SLO 정의 (SRE와 협업)

- 엔드포인트별 SLO 예:
  - `GET /api/v1/products`: 가용성 99.9%, p95 300ms
  - `POST /api/v1/orders`: 가용성 99.95%, p95 800ms
- Prometheus에서 SLI 계산 → Grafana 대시보드 → 에러 버짓 추적

## 금지 사항

- `System.out.println()` — SLF4J 로거만
- 에러를 `catch (Exception e) {}`로 삼키기 — 최소 로깅
- 메트릭 이름에 고유 ID 포함 (카디널리티 폭발)
- 모든 요청 TRACE 레벨 찍기 (디스크·검색 비용)
- 에러 로그 없이 사용자에게만 500 반환
