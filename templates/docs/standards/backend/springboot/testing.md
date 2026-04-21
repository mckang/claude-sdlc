# Spring Boot — 테스트 표준

**기준 버전**: Spring Boot 3.x / JUnit 5 / Testcontainers 1.19+
**최종 갱신**: 2026-04

## 테스트 피라미드

- **단위 테스트 70%** (빠름, Spring 컨텍스트 없음)
- **통합 테스트 20%** (`@SpringBootTest`, Testcontainers)
- **E2E 5-10%** (실제 HTTP, 주요 플로우만)

## 단위 테스트

- **Spring 없이 POJO로** — `new UserService(mockRepo)` 로 직접 생성
- **Mockito는 최소한만** — 의존성 많으면 설계 이상 신호
- 네이밍: `should_~when_~` 또는 한글로 명확하게
  ```java
  @Test
  void 이메일이_이미_존재하면_중복_예외를_던진다() { ... }
  ```

## 통합 테스트

### `@SpringBootTest` 사용 기준
- 실제로 여러 빈의 상호작용을 검증할 때만
- 컨트롤러 단일 검증은 `@WebMvcTest`로 빠르게

### 레이어별 전용 슬라이스
| 슬라이스 | 대상 |
|---------|------|
| `@WebMvcTest` | 컨트롤러만 (서비스 mock) |
| `@DataJpaTest` | Repository + 내장 DB |
| `@JsonTest` | 직렬화/역직렬화 |
| `@RestClientTest` | 외부 HTTP 클라이언트 |

### DB는 반드시 Testcontainers로

H2 인메모리 DB 금지 — 프로덕션 DB(Postgres/MySQL)와 방언 다름:

```java
@Testcontainers
@SpringBootTest
class UserIntegrationTest {
    @Container
    static PostgreSQLContainer<?> postgres = 
        new PostgreSQLContainer<>("postgres:16-alpine");
    
    @DynamicPropertySource
    static void props(DynamicPropertyRegistry r) {
        r.add("spring.datasource.url", postgres::getJdbcUrl);
        r.add("spring.datasource.username", postgres::getUsername);
        r.add("spring.datasource.password", postgres::getPassword);
    }
}
```

- **컨테이너 재사용**: `.withReuse(true)` + `~/.testcontainers.properties` 에 `testcontainers.reuse.enable=true` 로 속도 개선

## 테스트 데이터

- **빌더 패턴** 또는 **테스트 팩토리**
  ```java
  User user = UserFixtures.aUser()
      .withEmail("test@example.com")
      .build();
  ```
- **랜덤 데이터는 신중히** — 재현 가능해야 함 (시드 고정)
- 각 테스트는 **자기 데이터 만들어 씀** — 테스트 간 순서 의존 금지

## 트랜잭션과 격리

- `@Transactional`을 테스트에 붙이면 **자동 롤백** → 편하지만 실제 커밋 동작 검증 불가
- 비동기·이벤트 리스너 검증할 땐 `@Transactional` 빼고 명시적 정리

## Mock vs 실제 구현

| 상황 | 선택 |
|------|------|
| 외부 HTTP (결제, OAuth) | **WireMock** — 실제 응답 흉내 |
| 메시지 큐 (SQS, Kafka) | **Testcontainers** — 실제 큐 |
| 이메일 | **GreenMail** 또는 mock |
| DB | **Testcontainers** (H2 금지) |
| 시간 | `Clock` 빈 주입 → 테스트에서 고정 |

## E2E (인수 테스트)

- **RestAssured** 또는 `WebTestClient`
- 로그인 → 핵심 플로우 → 로그아웃 같은 **사용자 시나리오** 중심
- 데이터 세팅은 API를 통해 (DB 직접 조작 금지 — 실제 환경과 괴리)

## 성능·부하 테스트

- 단위·통합 테스트와 별도 (`performance/` 디렉터리 또는 별도 Gradle task)
- **k6 또는 Gatling**
- CI에선 스모크 수준만, 본격 부하는 주간·릴리스 전 수동

## 커버리지

- **JaCoCo** 로 측정, **최소 70%** 라인 기준 (팀 합의 조정 가능)
- **커버리지 수치에 집착 금지** — 의미 있는 분기를 놓치면 90%도 소용없음
- `@Generated` 또는 Record·DTO는 제외

## 금지 사항

- `Thread.sleep()` — Awaitility 쓰거나 이벤트 기반 대기
- 테스트에서 **프로덕션 DB 접속** — 절대 금지
- 테스트 간 상태 공유 (`static` 변수, 공유 파일) — 병렬 실행 깨짐
- 실패 시 무시 (`@Disabled` 방치) — 주석으로 왜 비활성화했는지 명시 또는 제거
