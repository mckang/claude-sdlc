# Database — 명명 규칙

**기준**: PostgreSQL / MySQL 공통 (차이점은 명시)
**최종 갱신**: 2026-04

## 핵심 원칙

- **snake_case 통일** — SQL은 대소문자 구분 모호, snake가 가장 안전
- **복수형 테이블, 단수형 컬럼** — `users` 테이블의 `user_id` 는 다른 테이블에서 외래키
- **축약 금지** (단, 업계 표준은 예외: `url`, `id`, `http`)
- **예약어 회피** — `user`, `order`, `group` 같은 표준 SQL 예약어는 피하거나 따옴표 필요

## 테이블명

- **복수형 snake_case**: `users`, `order_items`, `product_categories`
- 이유: 컬렉션 의미 명확. SELECT 문이 영어로 읽힘 (`SELECT * FROM users`)
- **예외**: 일부 팀은 단수형 선호 (`user`). 팀 내 일관성만 유지하면 OK
- **조인 테이블**: 관련 두 테이블 알파벳 순 + 관계 의미
  - `users_roles` (다대다)
  - `user_subscriptions` (관계에 추가 속성 있으면 의미 있는 이름)

## 컬럼명

| 유형 | 규칙 | 예 |
|------|------|---|
| 기본키 | `id` (integer/bigint/uuid) | `id` |
| 외래키 | `<단수 테이블명>_id` | `user_id`, `order_id` |
| 불린 | `is_*`, `has_*`, `can_*` | `is_active`, `has_verified_email` |
| 타임스탬프 | `*_at` | `created_at`, `updated_at`, `deleted_at` |
| 날짜 | `*_date` | `birth_date`, `expires_date` |
| 카운트 | `*_count` | `view_count`, `retry_count` |
| 금액 | `*_amount` 또는 단위 포함 | `price_cents`, `amount_krw` |
| JSON/JSONB | `*_data`, `*_json` | `metadata`, `settings_json` |

### 금액 처리 주의

- **돈은 정수로** (가장 작은 단위) — float 쓰면 반올림 버그
  - 원화: `price_krw` (정수, 원 단위)
  - 달러: `price_cents` (정수, 센트 단위)
  - DECIMAL 타입도 OK (`price NUMERIC(12, 2)`) — 통화 계산은 이쪽 권장

### 타임스탬프 규칙

- **UTC + `TIMESTAMPTZ`** (Postgres) / `TIMESTAMP` (MySQL은 자동 UTC 아님, 주의)
- 표준 감사(audit) 컬럼:
  ```sql
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ  -- NULL이면 살아있음
  ```
- `updated_at` 은 트리거 또는 ORM 훅으로 자동 갱신

## 인덱스명

형식: `idx_<테이블>_<컬럼들>` 또는 목적이 명확할 땐 `idx_<테이블>_<용도>`

```sql
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_orders_user_id_created_at ON orders(user_id, created_at DESC);
CREATE INDEX idx_posts_search ON posts USING gin(to_tsvector('korean', title));
```

- 유니크는 `uq_*`: `CREATE UNIQUE INDEX uq_users_email ON users(email)`
- 부분 인덱스: `idx_orders_pending ON orders(created_at) WHERE status = 'pending'`

## 제약조건명

| 유형 | 접두 | 예 |
|------|------|---|
| Primary Key | `pk_` | `pk_users` |
| Foreign Key | `fk_<테이블>_<참조테이블>` | `fk_orders_users` |
| Unique | `uq_<테이블>_<컬럼>` | `uq_users_email` |
| Check | `ck_<테이블>_<규칙>` | `ck_orders_amount_positive` |

```sql
ALTER TABLE orders 
    ADD CONSTRAINT fk_orders_users 
    FOREIGN KEY (user_id) REFERENCES users(id);

ALTER TABLE orders 
    ADD CONSTRAINT ck_orders_amount_positive 
    CHECK (amount >= 0);
```

- 이름 명시 안 하면 DB가 자동 생성하는데 가독성 나쁨 (`orders_user_id_fkey`)
- 명시적 이름은 마이그레이션·롤백 시 참조 편함

## 스키마/네임스페이스

- **스키마 분리** (Postgres): 큰 프로젝트에서 도메인 단위 (`public`, `billing`, `analytics`)
- `public` 에 너무 많은 테이블 쌓지 말 것
- 크로스 스키마 FK는 조심스럽게

## 시퀀스·인덱스 외 객체

| 유형 | 접두 | 예 |
|------|------|---|
| 시퀀스 | `seq_` | `seq_orders_id` |
| 뷰 | `v_` | `v_active_users` |
| 머터리얼라이즈드 뷰 | `mv_` | `mv_daily_revenue` |
| 함수 | 동사 (snake) | `update_modified_at()` |
| 트리거 | `trg_<테이블>_<이벤트>` | `trg_orders_before_update` |

## Enum vs 테이블

- **후보가 고정적·짧음 → enum 타입** (Postgres) 또는 CHECK 제약
  ```sql
  CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled');
  ```
- **후보가 자주 추가됨 → 별도 테이블 + FK**
- Enum 수정은 어렵다 (특히 값 삭제·순서 변경) — 성장하는 제품은 테이블 선호

## JSON 컬럼

- Postgres: **`JSONB`** (바이너리, 인덱스 가능) — `JSON` 대신
- MySQL: `JSON`
- 네이밍: 용도 기반 (`metadata`, `settings`, `preferences`)
- **남용 금지**: 쿼리·인덱스할 필드는 정규 컬럼으로

## 예약어·특수문자 회피

피해야 할 이름 (DB마다 다르지만 공통적으로 위험):
- `user` (Postgres는 예약어) → `users` 복수형으로 자연스레 회피
- `order` (ORDER BY와 충돌) → `orders`
- `group`, `key`, `type`, `status` 같은 단어도 주의
- 컬럼명도 마찬가지 — `key` 대신 `lookup_key` 등

## ORM과의 일치

### Spring Boot (JPA/Hibernate)
- 기본 네이밍 전략 `SnakeCasePhysicalNamingStrategy` 사용
- 엔티티 `User` → 테이블 `users` 는 `@Table(name = "users")` 명시

### Drizzle/Prisma (TS)
- Drizzle: `pgTable("users", { id: serial(), createdAt: timestamp("created_at") })`
- Prisma: `@@map("users")`, `@map("created_at")`

### SQLAlchemy (Python)
- `__tablename__ = "users"`
- 필드명은 Python에서 snake_case 그대로 사용 가능

## 금지 사항

- 대문자 테이블/컬럼명 (`Users`, `UserId`)
- 헝가리안 표기 (`tblUsers`, `strName`)
- 의미 모호한 이름 (`data`, `value`, `info`, `temp`)
- 한국어/한자 컬럼명
- 예약어를 컬럼명으로 사용
- 숫자로 시작하는 이름
- 64자 초과 (Postgres 제한 63, MySQL 64)
- 같은 테이블 안 중복 개념 컬럼 (`name`, `title`, `label` 섞기)
