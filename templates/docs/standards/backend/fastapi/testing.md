# FastAPI — 테스트 표준

**기준 버전**: pytest 8.x / pytest-asyncio / httpx / testcontainers-python
**최종 갱신**: 2026-04

## 도구

| 레벨 | 도구 |
|------|------|
| 단위 | pytest + pytest-asyncio |
| 통합 | pytest + httpx(AsyncClient) + Testcontainers |
| E2E | pytest + httpx (실제 서버) 또는 Playwright |

## 기본 설정

```toml
# pyproject.toml
[tool.pytest.ini_options]
asyncio_mode = "auto"
testpaths = ["tests"]
addopts = "-ra --strict-markers"
```

## 공용 fixture: conftest.py

```python
# tests/conftest.py
import pytest
from httpx import ASGITransport, AsyncClient
from testcontainers.postgres import PostgresContainer
from app.main import create_app
from app.database import Base, get_db

@pytest.fixture(scope="session")
def postgres_url():
    with PostgresContainer("postgres:16-alpine") as pg:
        yield pg.get_connection_url().replace("psycopg2", "asyncpg")

@pytest.fixture
async def db_session(postgres_url):
    engine = create_async_engine(postgres_url)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    
    async with AsyncSession(engine) as session:
        yield session
    
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)

@pytest.fixture
async def client(db_session):
    app = create_app()
    app.dependency_overrides[get_db] = lambda: db_session
    async with AsyncClient(
        transport=ASGITransport(app=app), 
        base_url="http://test"
    ) as c:
        yield c
```

- **`dependency_overrides`** 로 외부 의존성 쉽게 교체
- `AsyncClient` + `ASGITransport` — 실제 HTTP 서버 띄울 필요 없음

## 단위 테스트

```python
# tests/user/test_service.py
import pytest
from app.user.service import UserService
from app.exceptions import DuplicateEmailError

class FakeUserRepo:
    async def find_by_email(self, email):
        return {"id": 1, "email": email} if email == "exists@test.com" else None

async def test_이메일_중복_시_에러():
    service = UserService(repo=FakeUserRepo())
    with pytest.raises(DuplicateEmailError):
        await service.create(email="exists@test.com", password="pw12345678", name="A")
```

- **의존성 주입 활용** — fake/mock 쉽게 교체
- `unittest.mock.AsyncMock` 보다 **타입 있는 fake 클래스** 선호

## 통합 테스트

```python
async def test_POST_users(client):
    res = await client.post("/api/v1/users", json={
        "email": "a@b.com",
        "password": "password123",
        "name": "Alice",
    })
    assert res.status_code == 201
    assert res.headers["location"].startswith("/api/v1/users/")
    assert res.json()["email"] == "a@b.com"

async def test_중복_이메일_409(client):
    await client.post("/api/v1/users", json={...})
    res = await client.post("/api/v1/users", json={...})  # 같은 이메일
    assert res.status_code == 409
```

## DB는 Testcontainers

- SQLite 금지 — Postgres 고유 기능(JSONB, array, CTE, LATERAL) 차이
- 세션마다 컨테이너 재사용, 테스트마다 트랜잭션 롤백

## 파라미터라이즈드 테스트

```python
@pytest.mark.parametrize("email,valid", [
    ("a@b.com", True),
    ("invalid", False),
    ("", False),
    ("a@b", False),
])
def test_email_validation(email, valid):
    ...
```

## 비동기 외부 호출 mock

```python
import respx

@respx.mock
async def test_외부_api_재시도(client):
    route = respx.get("https://api.payment.com/v1/charge").mock(
        side_effect=[
            httpx.Response(503),
            httpx.Response(200, json={"ok": True}),
        ]
    )
    res = await client.post("/api/v1/checkout", json={...})
    assert res.status_code == 200
    assert route.call_count == 2  # 재시도 확인
```

- `respx` 가 httpx 전용 mock 라이브러리
- `requests` 쓴다면 `responses` 또는 `httpretty`

## 시간·UUID·난수 고정

- 테스트에서 결정론적 결과 필요
  - `freezegun` 으로 시간 고정
  - `uuid.uuid4` 를 DI로 주입해서 테스트에서 교체
- 시드 고정: `random.seed(42)`

## 인증 fixture

```python
@pytest.fixture
async def authed_client(client, db_session):
    user = await create_test_user(db_session)
    token = create_jwt(user.id)
    client.headers["Authorization"] = f"Bearer {token}"
    return client

async def test_authenticated_endpoint(authed_client):
    res = await authed_client.get("/api/v1/me")
    assert res.status_code == 200
```

## 커버리지

```bash
pytest --cov=app --cov-report=term-missing --cov-fail-under=70
```

- 목표 **70% 이상 라인**, 분기 커버리지는 추가 모니터링
- 마이그레이션·DTO 제외

## 성능 테스트

- `locust` 또는 `k6` — pytest 테스트와 별도 디렉터리
- CI에선 스모크만

## 금지 사항

- **`time.sleep()` / `asyncio.sleep()` 로 대기** — 이벤트/조건 기반 대기
- 실제 외부 API 호출 (`respx`/`responses` 로 mock)
- 테스트 간 DB 상태 공유
- `pytest.skip()` 남발 — 임시 비활성화면 이유 주석
- 프로덕션 DB로 테스트 실행
