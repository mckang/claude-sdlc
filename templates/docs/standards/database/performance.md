# Database — 성능 표준

**기준**: PostgreSQL (우선) / MySQL 8+
**최종 갱신**: 2026-04

## 성능 문제는 대부분 쿼리

- 서버 증설 전에 **쿼리 먼저**
- 90%의 DB 느림은 **인덱스 누락** 또는 **N+1**

## 인덱스 기본

### 언제 인덱스 필요한가

- **WHERE** 절에 자주 등장하는 컬럼
- **JOIN** 키
- **ORDER BY** 자주 사용되는 컬럼
- **UNIQUE** 제약 (자동 생성)

### 언제 불필요하거나 해로운가

- 카디널리티 낮음 (boolean 컬럼 단독) — 옵티마이저가 무시
- 작은 테이블 (수천 행 미만) — 풀스캔이 빠름
- 쓰기 비율 매우 높음 — 인덱스 유지 비용 > 조회 이득

### 복합 인덱스 설계

**왼쪽부터 매칭되는 순서**:

```sql
CREATE INDEX idx_orders_user_status_created 
    ON orders(user_id, status, created_at DESC);

-- 이 인덱스로 커버되는 쿼리:
WHERE user_id = 1                                    -- ✅
WHERE user_id = 1 AND status = 'paid'                -- ✅
WHERE user_id = 1 AND status = 'paid' ORDER BY created_at DESC  -- ✅

-- 커버 안 되는 쿼리 (왼쪽 누락):
WHERE status = 'paid'                                -- ❌ user_id 없음
WHERE status = 'paid' AND created_at > ...           -- ❌
```

원칙:
- **등호 조건(=) 먼저, 범위 조건(>, <) 나중**
- **선택도 높은(많이 거르는) 컬럼 먼저**
- ORDER BY 컬럼을 인덱스에 포함하면 정렬 스킵

### 커버링 인덱스

쿼리가 인덱스만 읽고 테이블 안 가게:

```sql
-- Postgres INCLUDE
CREATE INDEX idx_orders_user_amount 
    ON orders(user_id) INCLUDE (amount, created_at);

-- 이 쿼리는 테이블 안 건드림
SELECT user_id, amount, created_at FROM orders WHERE user_id = 1;
```

### 부분 인덱스 (Postgres)

```sql
CREATE INDEX idx_orders_pending 
    ON orders(created_at) 
    WHERE status = 'pending';
```

- 활성 데이터만 인덱스 → 작고 빠름
- Soft delete 쓸 때 특히 유용

## EXPLAIN 읽기

### Postgres

```sql
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM orders WHERE user_id = 1 AND status = 'paid';
```

핵심 체크 포인트:
- **Seq Scan** on 큰 테이블 → 인덱스 필요
- **Bitmap Heap Scan** → 조건이 선택도 나쁨 or 복합인덱스 필요
- **Nested Loop** 로 수백만 행 → Hash Join이 나을 수 있음
- **Rows=1000 actual=1** → 통계 부정확, `ANALYZE` 필요
- **Filter: ...** 많은 행 필터링 → 인덱스 조건 아님

### 유용한 쿼리

```sql
-- 느린 쿼리 찾기 (Postgres)
SELECT query, mean_exec_time, calls, total_exec_time
FROM pg_stat_statements
ORDER BY total_exec_time DESC
LIMIT 20;

-- 인덱스 사용 안 되는 것
SELECT schemaname, tablename, indexname, idx_scan
FROM pg_stat_user_indexes
WHERE idx_scan = 0;
```

## N+1 쿼리

가장 흔한 성능 버그:

```python
# ❌ N+1 (주문 100개면 101번 쿼리)
orders = db.query(Order).all()
for o in orders:
    print(o.user.name)  # 매번 user 조회
```

해결:
```python
# ✅ 한 번에 로드
orders = db.query(Order).options(joinedload(Order.user)).all()
```

- Spring JPA: `@EntityGraph` 또는 `JOIN FETCH`
- Drizzle: `with: { user: true }`
- Prisma: `include: { user: true }`
- SQLAlchemy: `joinedload` / `selectinload`

**ORM 로그를 반드시 개발 중 확인**:
- Spring: `spring.jpa.show-sql=true`
- Drizzle: `drizzle({ logger: true })`
- Prisma: `log: ['query']`

## 페이지네이션

### Offset 페이지네이션의 함정

```sql
-- 페이지 100 (1000행 이후)
SELECT * FROM posts ORDER BY id LIMIT 10 OFFSET 10000;
```

- **OFFSET 이 커질수록 느림** — 앞 10000행을 읽고 버림
- 실시간 데이터엔 중복·누락 가능 (새 행 삽입되면 OFFSET 흔들림)

### Cursor 페이지네이션

```sql
SELECT * FROM posts 
WHERE id < $last_id 
ORDER BY id DESC 
LIMIT 10;
```

- **인덱스 효율** 유지
- 일관된 결과
- 응답에 `next_cursor` 포함

## 쿼리 최적화 기법

### `SELECT *` 금지

- 불필요한 컬럼 → 네트워크, 디스크, 메모리 낭비
- 커버링 인덱스 기회 놓침
- **명시적 컬럼 리스트**

### WHERE 절에서 함수 사용 주의

```sql
-- ❌ 인덱스 안 탐
WHERE LOWER(email) = 'alice@test.com'

-- ✅ 함수 인덱스 (Postgres)
CREATE INDEX idx_users_email_lower ON users(LOWER(email));

-- ✅ 또는 저장 시 정규화
email_lower TEXT GENERATED ALWAYS AS (LOWER(email)) STORED
```

### `IN` vs `EXISTS`

- 작은 리스트: `IN` OK
- 서브쿼리: 대체로 `EXISTS` 가 나음 (짧은 회로)

### `OR` 는 인덱스 적 (많은 경우)

```sql
-- ❌ 인덱스 파편화
WHERE user_id = 1 OR email = 'a@b.com'

-- ✅ UNION 분리 (각각 인덱스)
SELECT * FROM users WHERE user_id = 1
UNION
SELECT * FROM users WHERE email = 'a@b.com'
```

## 트랜잭션·락

### 짧게 유지

```python
# ❌ 락 오래
with transaction():
    order = get_order(id)
    external_payment_api.charge(...)  # 네트워크 I/O 동안 락
    order.mark_paid()
```

```python
# ✅ 외부 호출을 트랜잭션 밖으로
result = external_payment_api.charge(...)
with transaction():
    order = get_order(id)
    order.mark_paid(result.payment_id)
```

### 적절한 격리 수준

- 기본값(보통 `READ COMMITTED`)에서 출발
- `SERIALIZABLE` 은 진짜 필요할 때만 (충돌 시 재시도 로직 필수)
- 금융·재고 같은 경합 높은 곳은 **비관적 락** (`SELECT ... FOR UPDATE`)

### 데드락 방지

- **자원 획득 순서 일관되게**
- 긴 트랜잭션 쪼개기
- `lock_timeout` 설정 (무한 대기 방지)

## 연결 풀

### 크기 결정

- `connections = ((core_count * 2) + effective_spindle_count)` (고전 공식)
- 실제로는 **앱 인스턴스 수 × 인스턴스당 풀 크기 ≤ DB 최대 연결** 맞추기
- 너무 크면 DB 컨텍스트 스위칭 낭비, 너무 작으면 큐잉

### HikariCP (Spring Boot)

```yaml
spring.datasource.hikari:
  maximum-pool-size: 10
  minimum-idle: 2
  connection-timeout: 3000
  max-lifetime: 1800000  # 30분 (DB idle timeout보다 짧게)
```

### PgBouncer (Postgres)

서버리스·대규모 앱에서 권장:
- **transaction pooling** 모드 — prepared statement 제약 있음
- 앱 수가 많으면 필수

## 캐싱

### 레이어별

1. **애플리케이션 메모리** (Caffeine, in-memory) — 제일 빠름, 단일 인스턴스
2. **Redis** — 분산 공유
3. **CDN** — 정적 응답

### 무엇을 캐시하나

- **자주 읽고 거의 안 바뀜** (설정, 국가 코드, 카테고리)
- **비싼 계산** (대시보드 집계)
- **외부 API 응답** (짧은 TTL)

### 무효화

> "컴퓨터 과학의 두 가지 어려운 문제: 캐시 무효화, 네이밍, off-by-one"

- **TTL 기반**: 단순, 과도한 지연 허용 시
- **이벤트 기반**: 정확하지만 복잡 (DB 변경 → 캐시 삭제)
- **Cache-aside**: 읽을 때 miss 면 DB → 캐시 저장

## VACUUM / 통계 (Postgres)

- `autovacuum` 활성 유지
- **bulk 변경 후 수동 `ANALYZE`** 권장 (대용량 백필 이후)
- `pg_stat_user_tables` 의 `n_dead_tup` 감시
- **HOT update 가능하게** — 인덱스 컬럼 자주 변경 피하기

## 모니터링

- Postgres: `pg_stat_statements`, `pg_stat_activity`
- 쿼리당 메트릭: 평균/p95 실행시간, 호출 횟수
- **Long-running query 알림** (예: 5초 초과)
- **커넥션 풀 사용률** 80% 초과 시 알림

## 금지 사항

- `SELECT *` 
- 프로덕션에서 `EXPLAIN` 없이 최적화
- 인덱스 무작위 추가 (쓰기 느려짐)
- ORM에 **모든 것을 맡기고** SQL 로그 안 보기
- 트랜잭션 안에서 외부 HTTP 호출
- 대용량 테이블 `COUNT(*)` 남발 (Postgres는 추정값으로 대체)
- `ORDER BY RANDOM()` 대용량 (전체 정렬) — 샘플링 대안 사용
