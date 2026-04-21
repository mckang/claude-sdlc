# Spring Boot — API 표준

**기준 버전**: Spring Boot 3.x / Java 21
**최종 갱신**: 2026-04

## URI 설계

- **명사 복수형 리소스**: `/api/v1/users`, `/api/v1/orders` — 동사 금지 (❌ `/getUsers`)
  - 왜: REST의 핵심은 "리소스에 동작을 한다"는 개념. 동사 URL은 RPC 스타일에 가까워 일관성 무너짐.
- **버전 prefix 필수**: `/api/v1/...` — 하위 호환 깨는 변경 시 v2로 분기
- **케밥 케이스**: `/api/v1/order-items` (스네이크·카멜 금지)
- **식별자는 경로, 필터는 쿼리**: `/users/{id}?include=orders&status=active`

## HTTP 메서드와 상태 코드

| 동작 | 메서드 | 성공 | 실패 예 |
|------|--------|------|---------|
| 조회 | GET | 200, 404 | — |
| 생성 | POST | 201 + Location | 400, 409 |
| 전체 수정 | PUT | 200 or 204 | 400, 404 |
| 부분 수정 | PATCH | 200 or 204 | 400, 404 |
| 삭제 | DELETE | 204 | 404 |

- **201 Created**에는 반드시 `Location` 헤더로 생성된 리소스 URI 반환
- **204 No Content**는 바디 없음. 바디 보낼 거면 200

## 요청/응답 객체 (DTO)

- **Record 사용** (Java 16+): 불변이고 보일러플레이트 없음
  ```java
  public record UserCreateRequest(
      @NotBlank String email,
      @NotBlank @Size(min = 8) String password,
      @NotBlank String name
  ) {}
  ```
- **엔티티를 직접 노출 금지** — JPA 엔티티를 컨트롤러 응답으로 쓰면 순환참조·N+1·민감 필드 노출 위험
- **검증은 `jakarta.validation`** — 컨트롤러 파라미터에 `@Valid` 필수
- **응답 공통 래퍼는 쓰지 말 것** — `{"code": 0, "data": {...}}` 같은 래퍼는 HTTP 상태코드를 무력화함. 표준 HTTP 활용

## 에러 응답 (RFC 7807 — Problem Details)

Spring Boot 3의 `ProblemDetail` 표준 활용:

```json
HTTP/1.1 400 Bad Request
Content-Type: application/problem+json

{
  "type": "https://api.example.com/errors/validation",
  "title": "Validation Failed",
  "status": 400,
  "detail": "email 필드가 올바른 이메일 형식이 아닙니다",
  "instance": "/api/v1/users",
  "errors": [
    { "field": "email", "code": "INVALID_FORMAT" }
  ]
}
```

- `@RestControllerAdvice` 로 예외 → ProblemDetail 매핑 중앙화
- 내부 스택트레이스·SQL 메시지 노출 금지 (로그에만 기록, 응답에는 `traceId`만)

## 페이지네이션

- **cursor 기반 선호** (대용량·실시간 데이터)
  - 응답: `{ "items": [...], "nextCursor": "eyJpZCI6..." }`
- **offset/limit는 관리자 화면 같은 정적 데이터에만**
- Spring Data의 `Pageable`은 offset 기반이라 cursor 필요하면 커스텀 구현

## 동시성·멱등성

- **POST는 기본적으로 비멱등** → 재시도로 중복 생성 가능
- 결제·주문 같은 중요 POST에는 **멱등키(Idempotency-Key 헤더)** 도입
  - 클라이언트가 UUID 생성 → 서버가 키+결과 캐싱 (24h)
- **PUT은 멱등이어야 한다** — 같은 요청을 N번 보내도 결과 동일

## 비동기 API

- 짧게 끝나지 않는 작업(리포트 생성, 대량 처리)은 **202 Accepted + 작업 URL**
  ```
  POST /api/v1/reports
  → 202 Accepted
    Location: /api/v1/jobs/abc123
  
  GET /api/v1/jobs/abc123
  → 200 { "status": "completed", "resultUrl": "..." }
  ```

## 금지 사항

- 컨트롤러에 비즈니스 로직 — 서비스 계층으로
- `@Transactional`을 컨트롤러에 — 서비스에만
- 응답에 `null` 필드 방치 — `@JsonInclude(NON_NULL)` 로 제거 or 필드 제거
- 쿼리 파라미터로 민감정보 (토큰, 비밀번호) — 헤더/바디로
