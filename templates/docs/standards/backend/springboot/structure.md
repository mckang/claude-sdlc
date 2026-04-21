# Spring Boot — 프로젝트 구조

**기준 버전**: Spring Boot 3.x / Java 21
**최종 갱신**: 2026-04

## 패키지 구성: 도메인 중심 (권장)

레이어 중심(`controller/`, `service/`, `repository/`)보다 **도메인 중심** 권장:

```
com.example.app
├── user
│   ├── UserController.java
│   ├── UserService.java
│   ├── UserRepository.java
│   ├── User.java                  (엔티티)
│   └── dto/
│       ├── UserCreateRequest.java
│       └── UserResponse.java
├── order
│   ├── OrderController.java
│   ├── OrderService.java
│   └── ...
└── common
    ├── config/
    ├── exception/
    └── util/
```

- **왜**: 기능 변경 시 한 패키지 안에서 완결. 레이어 중심은 작은 기능 하나 바꿔도 4개 패키지를 오가야 함.
- **예외**: 정말 공유되는 것만 `common/` — 섣불리 공통화하면 결합도 증가

## 모듈 vs 단일 프로젝트

- **초기엔 단일 프로젝트**로 시작. 경계가 명확해지면 Gradle 멀티 모듈로 분리
- 도메인 단위로 모듈 분리 (`user-module`, `order-module`) — 레이어 단위 모듈 분리(`api-module`, `service-module`) 금지

## 레이어 규칙

```
Controller → Service → Repository
   ↓           ↓           ↓
  DTO      Domain        Entity
```

- **Controller**: HTTP 관심사만 (요청 파싱, 응답 변환). 비즈니스 로직 금지.
- **Service**: 비즈니스 로직 + 트랜잭션 경계. `@Transactional`은 여기만.
- **Repository**: 데이터 접근만. 비즈니스 로직 들어가면 서비스에 숨은 의존성 생김.
- **Controller가 Repository를 직접 호출 금지** — 항상 Service 경유

## 의존성 관리 (build.gradle)

```kotlin
plugins {
    id("org.springframework.boot") version "3.2.x"
    id("io.spring.dependency-management") version "1.1.x"
    java
}

java {
    toolchain {
        languageVersion = JavaLanguageVersion.of(21)
    }
}

dependencies {
    // 런타임
    implementation("org.springframework.boot:spring-boot-starter-web")
    implementation("org.springframework.boot:spring-boot-starter-validation")
    implementation("org.springframework.boot:spring-boot-starter-data-jpa")
    
    // 테스트
    testImplementation("org.springframework.boot:spring-boot-starter-test")
    testImplementation("org.testcontainers:junit-jupiter:1.19.x")
    testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}
```

- **starter 먼저 고려** — 개별 의존성 찾지 말고 starter로
- **Lombok은 선택** — Record로 대체 가능한 건 Record 우선
- **의존성 버전 하드코딩 금지** — Spring BOM에 맡기고, 필요시에만 override

## 설정 (application.yml)

- **프로파일별 분리**: `application.yml`(공통) + `application-{local,dev,prod}.yml`
- **비밀키 하드코딩 금지**: `${DB_PASSWORD}` 형태로 환경변수
- **@ConfigurationProperties 선호** (not `@Value`):
  ```java
  @ConfigurationProperties(prefix = "app.jwt")
  public record JwtProperties(String secret, Duration expiration) {}
  ```
  - 왜: 타입 안전, IDE 자동완성, 검증 가능

## 트랜잭션 전파

- 기본값 `REQUIRED` 유지. `REQUIRES_NEW`, `NESTED`는 **진짜 필요한 경우만** 문서화하며 쓸 것
- **읽기 전용은 `readOnly = true`** — DB 드라이버·ORM 최적화 힌트
- 트랜잭션 안에서 외부 API 호출 금지 — 커넥션 홀딩 길어지면 풀 고갈

## 네이밍 컨벤션

| 종류 | 규칙 | 예시 |
|------|------|------|
| 패키지 | 소문자, 단수형 | `user`, `order` |
| 클래스 | PascalCase | `UserService` |
| 메서드 | camelCase, 동사 시작 | `findByEmail` |
| 상수 | UPPER_SNAKE | `MAX_RETRY_COUNT` |
| 테스트 클래스 | `~Test` 접미 | `UserServiceTest` |
| DTO | 목적 명시 | `UserCreateRequest`, `UserResponse` |

## 금지 사항

- `@Autowired` 필드 주입 → **생성자 주입**만 (Record나 Lombok `@RequiredArgsConstructor`)
- 순환 의존성 (`UserService ↔ OrderService`) → 공통 이벤트·인터페이스로 분리
- `static` 유틸 클래스에 로직 가두기 → 테스트·교체 어려움. Spring 빈으로
- 엔티티를 여러 컨텍스트에서 공유 → 도메인별 엔티티 분리
