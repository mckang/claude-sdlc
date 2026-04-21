# Database — 마이그레이션 전략

**기준**: PostgreSQL / Flyway · Liquibase · Alembic · Drizzle Kit
**최종 갱신**: 2026-04

## 핵심 원칙

- **모든 스키마 변경은 마이그레이션 파일로** — 콘솔에서 수동 ALTER 절대 금지
- **마이그레이션은 불변** — 머지된 마이그레이션 파일 수정 금지, 새 마이그레이션으로 보정
- **프로덕션은 무중단** — 릴리스와 마이그레이션 분리

## 도구 선택

| 도구 | 생태계 |
|------|--------|
| **Flyway** | Spring Boot, Java |
| **Liquibase** | Java, XML/YAML 선호 |
| **Alembic** | Python / SQLAlchemy |
| **Drizzle Kit** | TypeScript / Drizzle |
| **Prisma Migrate** | TypeScript / Prisma |
| **Knex/Umzug** | Node.js 일반 |

도구 선택보다 **규칙 준수가 중요**.

## 파일 네이밍

- 타임스탬프 + 설명: `20260417_1530__add_users_phone.sql`
- 또는 순번: `V001__create_users.sql`
- 설명은 **무엇을 하는지 동사로** (`add_`, `drop_`, `rename_`)

## 마이그레이션 작성 원칙

### 1. 작게 쪼개기

```
❌ 나쁨: V010__big_changes.sql  (100개 변경)
✅ 좋음: 
  V010__add_users_phone.sql
  V011__create_orders_table.sql
  V012__add_orders_index.sql
```

작게 쪼개면:
- 실패해도 복구 지점 명확
- 리뷰 용이
- 병합 충돌 감소

### 2. 롤백 가능하게 (가능하면)

- 많은 도구가 `up` / `down` 분리
- 복잡한 변경은 down 작성 어려움 → 대신 **forward-only 보정 마이그레이션**으로 처리
- **데이터 복구 계획**을 마이그레이션 리뷰에 포함

### 3. 트랜잭션 명시

- Postgres: 대부분의 DDL이 트랜잭션 안에서 됨 (예외: `CREATE INDEX CONCURRENTLY`)
- MySQL: DDL은 암시적 커밋 — 트랜잭션 보호 약함

## 온라인 마이그레이션 패턴

프로덕션 무중단 변경은 **여러 단계**로 나눠 배포.

### 패턴 1: NOT NULL 컬럼 추가

**나쁨** (바로 NOT NULL):
```sql
-- 테이블 락 + 기본값 채우는 동안 I/O 폭주
ALTER TABLE users ADD COLUMN phone TEXT NOT NULL DEFAULT '';
```

**좋음** (3단계):

```sql
-- 1단계: NULL 허용 컬럼 추가 (빠름)
ALTER TABLE users ADD COLUMN phone TEXT;

-- 2단계: 배치로 백필
UPDATE users SET phone = '' WHERE phone IS NULL AND id BETWEEN 1 AND 10000;
-- ... 반복

-- 3단계: NOT NULL 제약 (Postgres 11+: 기본값 있으면 빠름)
ALTER TABLE users ALTER COLUMN phone SET NOT NULL;
```

Postgres 11+ 에서는 `DEFAULT` 값 있는 컬럼 추가가 메타데이터만 변경 → 빠름. 하지만 **락 시간 확인 필수**.

### 패턴 2: 컬럼 삭제

**단계**:
1. 애플리케이션 코드에서 컬럼 **쓰기 중단** (배포)
2. 애플리케이션 코드에서 컬럼 **읽기 중단** (배포)
3. 마이그레이션에서 컬럼 삭제

중간 단계를 건너뛰면 배포 중 **스키마-코드 불일치**로 장애.

### 패턴 3: 컬럼 이름 변경

**피하기**. 꼭 해야 한다면:
1. 새 컬럼 추가
2. 이중 쓰기 (old + new)
3. 백필
4. 읽기 새 컬럼으로 전환
5. 쓰기 새 컬럼만
6. 옛 컬럼 삭제

빠른 방법인 `ALTER ... RENAME` 은 **서비스 중단 허용**될 때만.

### 패턴 4: 인덱스 추가

```sql
-- ✅ Postgres: CONCURRENTLY (락 없이)
CREATE INDEX CONCURRENTLY idx_orders_user_id ON orders(user_id);
```

- `CONCURRENTLY` 는 **트랜잭션 밖**에서만 가능 → 도구 설정 확인
- 실패하면 `INVALID` 인덱스 남음 → 찾아서 DROP

```sql
-- MySQL 5.6+: 대부분 online, 하지만 느림
ALTER TABLE orders ADD INDEX idx_user_id (user_id);
```

### 패턴 5: 컬럼 타입 변경

**위험** — 재작성 유발 가능:
- `INTEGER → BIGINT`: Postgres는 재작성
- `VARCHAR(50) → VARCHAR(100)`: Postgres는 빠름
- `TEXT → JSONB`: 재작성 + 변환

**권장**:
1. 새 컬럼 추가
2. 이중 쓰기 + 백필
3. 읽기 전환
4. 옛 컬럼 삭제

## 데이터 마이그레이션

스키마와 **별도 마이그레이션**으로 관리 권장:

```
V020__add_users_phone_column.sql    -- 스키마
V021__backfill_users_phone.sql      -- 데이터 (배치)
```

대용량 백필은:
- **배치로 쪼개기** (`WHERE id BETWEEN x AND y`)
- **락 타임아웃 설정**: `SET lock_timeout = '5s'`
- **진행 상황 로깅**
- 실패 시 재실행 가능하게 **멱등하게** 작성

## 위험 경고

### 테이블 락 유발 변경 (조심!)

- `ALTER TABLE ... ADD COLUMN` (기본값 없으면 Postgres 11+ 괜찮음)
- `ALTER TABLE ... ALTER COLUMN ... TYPE` (재작성)
- `ALTER TABLE ... RENAME COLUMN` (짧지만 락)
- `ALTER TABLE ... ADD CONSTRAINT ... CHECK` (기본 검증 시 풀스캔 락)
  - 해결: `NOT VALID` 추가 후 나중에 `VALIDATE CONSTRAINT`

### 실수하면 치명적

- `DROP TABLE` — 복구 어려움
- `TRUNCATE` — 롤백 불가 (MySQL은 그럼)
- 조건 없는 `UPDATE` / `DELETE`

**보호 장치**:
- Staging에서 먼저 실행
- Dry-run 지원 도구 사용
- 대용량 DELETE 는 배치로 + 검증

## 마이그레이션 리뷰 체크리스트

- [ ] Staging에서 실제 데이터 규모로 돌려봤는가
- [ ] 락 시간 측정했는가 (`EXPLAIN`, `pg_stat_activity`)
- [ ] 롤백 방법이 있는가 (코드 레벨 또는 forward 보정)
- [ ] 애플리케이션 배포 순서와 호환되는가
- [ ] 백업 충분한가 (대용량 변경 직전 스냅샷)
- [ ] 파괴적 변경(DROP, 타입 변경)에 필요한 단계 다 거쳤는가

## CI/CD 통합

- PR 머지 시 staging에 **자동 적용**
- 프로덕션은 **수동 승인** + 저트래픽 시간대
- 적용 후 **헬스체크 · 에러율 모니터링**

## 금지 사항

- 콘솔·DBeaver에서 수동 스키마 변경
- 이미 머지된 마이그레이션 파일 수정
- 프로덕션에 `--force` 옵션
- 테스트·스테이징 건너뛰고 직접 프로덕션
- 한 마이그레이션에 스키마 + 대용량 데이터 변경 섞기
- 이름·타입 변경을 단일 단계로
- FK·UNIQUE 없애는 마이그레이션에 **왜** 없애는지 주석 없음
