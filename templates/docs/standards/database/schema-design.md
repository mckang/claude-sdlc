# Database — 스키마 설계

**기준**: PostgreSQL (우선) / MySQL 8+
**최종 갱신**: 2026-04

## 기본 원칙

- **무결성 최우선** — FK·NOT NULL·CHECK·UNIQUE 는 타이핑 부담이 아니라 보험
- **정규화 후 필요시 비정규화** — 역순으로 가면 버그 잔치
- **데이터는 오래 산다** — 스키마 결정은 "5년 후에도 맞는가" 관점

## 기본키 (PK) 선택

| 유형 | 언제 | 장점 | 단점 |
|------|------|------|------|
| `BIGSERIAL` / `BIGINT IDENTITY` | 대부분의 OLTP | 작음, 순차, 인덱스 효율 | 순차라 예측 가능 (보안 노출 X) |
| `UUID v7` | 분산·공개 ID 필요 | 생성 분산 가능, 시간 정렬 | 16바이트 (4배 큼) |
| `UUID v4` | 무작위 공개 ID | 예측 불가 | 인덱스 단편화 |
| 자연키 (이메일 등) | **금지** — 변경 가능성 | — | 리팩토링 지옥 |

### 권장

- **기본은 `BIGSERIAL`** — 성능 우선
- **공개 식별자 필요하면 UUID v7** 컬럼 추가 (`public_id`)
  ```sql
  id         BIGSERIAL PRIMARY KEY,
  public_id  UUID NOT NULL UNIQUE DEFAULT gen_random_uuid_v7()
  ```
- 결코 **자연키를 PK로 쓰지 말 것** (이메일, 주민번호, 상품 코드) — 변경되면 전 테이블 수정

## NOT NULL은 기본

- 컬럼은 **기본 NOT NULL** — 모르면 NULL 가능으로 하지 말고 **필수 여부 먼저 결정**
- `NULL` 의미가 뭔지 명확해야 함: "없음"인가 "미정"인가 "해당 없음"인가
- NULL 세 상태 로직은 버그 근원 (`NULL = NULL` 은 `UNKNOWN`)

## 외래키 (FK)

### 반드시 선언

```sql
CREATE TABLE orders (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT NOT NULL,
    status     order_status NOT NULL DEFAULT 'pending',
    amount     BIGINT NOT NULL CHECK (amount >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    CONSTRAINT fk_orders_users 
        FOREIGN KEY (user_id) REFERENCES users(id)
        ON DELETE RESTRICT
);
```

### ON DELETE 정책

| 옵션 | 의미 | 언제 |
|------|------|------|
| `RESTRICT` (기본 권장) | 참조 있으면 삭제 차단 | 대부분의 관계 |
| `CASCADE` | 부모 삭제 시 자식도 삭제 | 진짜 종속 관계 (comment → post) |
| `SET NULL` | 부모 삭제 시 NULL | 관계 해제가 의미 있을 때 |
| `NO ACTION` | 커밋 시 검사 (지연) | 드물게 필요 |

- **Soft delete (`deleted_at`) 쓰면 FK CASCADE 주의** — 삭제 이벤트 발생 안 함

## 유니크 제약

```sql
-- 단일 컬럼
email TEXT NOT NULL UNIQUE

-- 복합
CONSTRAINT uq_user_project UNIQUE (user_id, project_id)

-- 부분 유니크 (Postgres)
CREATE UNIQUE INDEX uq_active_email 
    ON users(email) 
    WHERE deleted_at IS NULL;
```

- Soft delete 쓰면 **부분 유니크**로 active 행에만 적용

## Enum / Status 컬럼

### 후보가 고정: Postgres Enum

```sql
CREATE TYPE order_status AS ENUM ('pending', 'paid', 'shipped', 'delivered', 'cancelled');

CREATE TABLE orders (
    status order_status NOT NULL DEFAULT 'pending'
);
```

### 자주 추가됨: CHECK 제약 + 텍스트 (더 유연)

```sql
status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'paid', 'shipped', 'delivered', 'cancelled'))
```

### 더 복잡: 별도 테이블 (설명·순서 등 메타 필요시)

```sql
CREATE TABLE order_statuses (
    code        TEXT PRIMARY KEY,
    label       TEXT NOT NULL,
    sort_order  INT NOT NULL
);
```

## 감사(audit) 컬럼

모든 주요 테이블에:

```sql
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
created_by BIGINT REFERENCES users(id),  -- 선택
updated_by BIGINT REFERENCES users(id)   -- 선택
```

`updated_at` 자동 갱신:

```sql
CREATE OR REPLACE FUNCTION set_updated_at() 
RETURNS TRIGGER AS $$ 
BEGIN 
    NEW.updated_at := NOW(); 
    RETURN NEW; 
END; 
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_orders_updated_at 
    BEFORE UPDATE ON orders 
    FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

## Soft Delete vs Hard Delete

| 전략 | 장점 | 단점 |
|------|------|------|
| Soft (`deleted_at`) | 복구 가능, 감사 이력 | 모든 쿼리에 `WHERE deleted_at IS NULL` 필요 |
| Hard | 단순, 공간 절약 | 복구 불가, 법적 삭제 요구엔 맞음 |

**권장**: 사용자·주문·콘텐츠 등 복구 가능성 있는 것은 Soft. 로그·이벤트는 Hard + 파티션 만료.

## JSON 활용 기준

### JSON 쓸 때
- 구조가 엔티티마다 달라서 컬럼 고정 불가 (사용자 설정, 커스텀 필드)
- 외부 API 응답 원본 보존
- 자주 쿼리하지 않는 부가 정보

### JSON 쓰면 안 될 때
- 자주 검색·필터되는 필드 → 정규 컬럼
- FK 관계 필요 → 관계 테이블
- 집계 대상 → 정규 컬럼

```sql
-- ✅ 적절한 JSON 사용
CREATE TABLE users (
    id          BIGSERIAL PRIMARY KEY,
    email       TEXT NOT NULL UNIQUE,  -- 정규 컬럼
    name        TEXT NOT NULL,
    preferences JSONB NOT NULL DEFAULT '{}'::jsonb  -- 가변 스키마
);

-- JSON 내부 인덱스 (Postgres)
CREATE INDEX idx_users_theme ON users ((preferences->>'theme'));
```

## 비정규화 허용 상황

일반적으로 정규화가 맞지만, 다음엔 비정규화 가능:
- **집계 값** (`posts.comment_count`) — 트리거 or 주기적 갱신
- **조회 성능 크리티컬** — 조인 비용이 진짜 병목일 때
- **히스토리 보존** — 주문 시점 상품 이름·가격을 orders에 복사

비정규화 시 **무결성 유지 메커니즘** 명시:
- 트리거
- 애플리케이션 이중 쓰기 + 주기적 검증
- 이벤트 소싱

## 파티셔닝 (대용량)

- **억 단위 레코드 이상**에서 고려
- Postgres: 선언적 파티션 (`PARTITION BY RANGE (created_at)`)
- 시간 기반이 가장 흔함 (월별, 연도별)
- **파티션 키는 쿼리에 포함** — 아니면 파티션 이점 무용

## 마이그레이션 우선순위

큰 변경은 여러 단계로:
1. 새 컬럼 추가 (NULLABLE)
2. 코드가 둘 다 읽고 새 컬럼 쓰기
3. 백필
4. 코드가 새 컬럼만 사용
5. 예전 컬럼 삭제

(상세는 `migrations.md` 참조)

## 체크리스트: 새 테이블 만들 때

- [ ] PK 정의 (`BIGSERIAL` 또는 UUID)
- [ ] 모든 컬럼 NOT NULL 여부 결정
- [ ] FK 관계에 ON DELETE 정책
- [ ] UNIQUE 제약 (이메일, 슬러그 등)
- [ ] CHECK 제약 (금액 양수, 상태 enum)
- [ ] `created_at`, `updated_at`
- [ ] Soft delete 여부 결정
- [ ] 예상 크기·성장률 고려 (파티셔닝 필요?)
- [ ] 자주 조회할 컬럼 인덱스 계획

## 금지 사항

- PK 없는 테이블
- FK 없이 ID만 저장 ("논리적 관계")
- 비밀번호 평문 저장
- 주민번호·카드번호 평문 저장
- 한 테이블에 100+ 컬럼 (도메인 쪼개기 신호)
- BOOLEAN 컬럼명이 부정형 (`is_not_active`) — 이중부정 혼란
- 열거 값을 정수로만 저장 (`status = 3`이 뭔지 모름)
- `TEXT` 대신 의미없는 `VARCHAR(n)` — Postgres는 차이 없음, 오히려 제약
