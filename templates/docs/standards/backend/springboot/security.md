# Spring Boot — 보안 표준

**기준 버전**: Spring Boot 3.x / Spring Security 6.x
**최종 갱신**: 2026-04

## Spring Security 기본 설정

Spring Security 6부터 `WebSecurityConfigurerAdapter` 없어지고 **SecurityFilterChain 빈** 방식:

```java
@Configuration
@EnableWebSecurity
public class SecurityConfig {
    @Bean
    SecurityFilterChain api(HttpSecurity http) throws Exception {
        return http
            .securityMatcher("/api/**")
            .csrf(csrf -> csrf.disable())  // JWT API면 disable, 쿠키 기반이면 활성화
            .sessionManagement(s -> s.sessionCreationPolicy(STATELESS))
            .authorizeHttpRequests(auth -> auth
                .requestMatchers("/api/v1/auth/**", "/api/v1/health").permitAll()
                .anyRequest().authenticated()
            )
            .oauth2ResourceServer(o -> o.jwt(Customizer.withDefaults()))
            .build();
    }
}
```

## 인증 전략 선택

| 상황 | 권장 |
|------|------|
| SPA + 동일 도메인 | **HttpOnly 쿠키 + CSRF 토큰** |
| SPA + 별도 도메인 | **Access token in memory + Refresh token in HttpOnly 쿠키** |
| 모바일·서버-서버 | **Bearer JWT** |
| 내부 서비스 간 | **mTLS** 또는 짧은 수명 JWT |

### 왜 localStorage에 토큰을 두면 안 되는가
- XSS 하나로 전체 세션 탈취
- 2026년 보안 감사 기준에서 거의 항상 reject
- HttpOnly 쿠키는 JavaScript 접근 불가 → XSS로도 못 훔침

## JWT 운영

- **Access token**: 짧게 (15분 이내)
- **Refresh token**: 길게 (7-30일), **HttpOnly Secure SameSite=Lax 쿠키**
- **서명 알고리즘**: RS256 (비대칭) 권장. HS256은 키 공유 시에만
- **`none` 알고리즘 절대 금지**
- **토큰 취소(revocation)** 설계: 블랙리스트 or 짧은 수명 + 리프레시 회전

## 입력 검증

- **모든 외부 입력은 불신**: 컨트롤러 경계에서 `@Valid` 검증
- **Bean Validation 애너테이션** 활용:
  ```java
  public record RegisterRequest(
      @NotBlank @Email String email,
      @NotBlank @Size(min = 10, max = 128) String password,
      @NotBlank @Pattern(regexp = "^[a-zA-Z0-9_]+$") String username
  ) {}
  ```
- **도메인 검증은 서비스 계층에서** — 비즈니스 규칙(중복 이메일 등)

## SQL 인젝션 방어

- JPA/JPQL 사용 시 **파라미터 바인딩**만 사용
  ```java
  // ✅ OK
  @Query("SELECT u FROM User u WHERE u.email = :email")
  Optional<User> findByEmail(@Param("email") String email);
  
  // ❌ 금지
  String query = "SELECT u FROM User u WHERE u.email = '" + email + "'";
  ```
- Native Query도 `?` 또는 `:name` 바인딩만 — 문자열 concatenation 금지
- ORDER BY에 사용자 입력 넣을 땐 화이트리스트로 변환

## 비밀 관리

- `.env`, `application-prod.yml` 을 Git에 올리지 말 것
- **권장**:
  - 로컬: `.env` + `spring-dotenv`
  - 프로덕션: AWS Secrets Manager / HashiCorp Vault / Kubernetes Secrets
- 비밀은 **환경변수**로 주입, 코드에 하드코딩 금지
- 로그에 비밀 찍히지 않게 `toString()` 오버라이드 또는 `@JsonIgnore`

## 비밀번호 저장

- **BCrypt** (Spring Security 기본) 또는 **Argon2**
- 절대 MD5·SHA-1·plain text 금지
- 기본 cost factor 12 이상 (2026 기준)
  ```java
  @Bean
  PasswordEncoder passwordEncoder() {
      return new BCryptPasswordEncoder(12);
  }
  ```

## CORS

- 프로덕션에서 `*` 절대 금지 — 명시적 origin 화이트리스트
  ```java
  @Bean
  CorsConfigurationSource corsConfig() {
      var config = new CorsConfiguration();
      config.setAllowedOrigins(List.of("https://app.example.com"));
      config.setAllowedMethods(List.of("GET","POST","PUT","PATCH","DELETE"));
      config.setAllowCredentials(true);  // 쿠키 포함할 때
      var source = new UrlBasedCorsConfigurationSource();
      source.registerCorsConfiguration("/**", config);
      return source;
  }
  ```

## Rate Limiting

- **Bucket4j** 또는 Redis 기반 분산 rate limiter
- 인증 엔드포인트(`/login`, `/password-reset`)는 IP + 사용자명 조합으로 제한
- 실패 시 429 Too Many Requests + `Retry-After` 헤더

## 권한 체크 (인가)

- 메서드 레벨 `@PreAuthorize` 활용:
  ```java
  @PreAuthorize("hasRole('ADMIN') or #userId == authentication.name")
  public UserResponse findUser(String userId) { ... }
  ```
- **IDOR 방어**: 조회 시 소유자 검증 필수
  ```java
  Order order = orderRepo.findByIdAndOwnerId(orderId, currentUserId)
      .orElseThrow(() -> new NotFoundException());
  ```

## 헤더 보안

Spring Security가 기본으로 추가하는 헤더 유지:
- `X-Content-Type-Options: nosniff`
- `X-Frame-Options: DENY` (또는 `SAMEORIGIN`)
- `Strict-Transport-Security` (HTTPS 환경)
- `Content-Security-Policy` — 상황에 맞춰 구성

## 의존성 취약점

- **OWASP Dependency-Check** 또는 **Snyk** CI에 통합
- 주 1회 이상 자동 스캔
- Critical/High는 릴리스 전 반드시 처리

## 금지 사항

- `@PreAuthorize("permitAll()")` — 명시적 endpoint 허용으로 대체
- 디버그 정보·스택트레이스를 응답에 포함
- 세션 ID·토큰을 URL 쿼리 파라미터에
- 민감정보(비밀번호, 카드번호)를 로그에
- SQL/JPQL에 사용자 입력 문자열 concat
