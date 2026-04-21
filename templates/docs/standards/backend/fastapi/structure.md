# FastAPI — 프로젝트 구조

**기준 버전**: FastAPI 0.110+ / Python 3.12 / SQLAlchemy 2.0
**최종 갱신**: 2026-04

## 도메인 중심 디렉터리

```
app/
├── main.py                    # FastAPI() 앱 생성, 라우터 등록
├── config.py                  # Settings (Pydantic Settings)
├── database.py                # DB 엔진·세션 팩토리
├── dependencies.py            # 공통 Depends
├── exceptions.py              # 공통 예외 + 핸들러
├── user/
│   ├── __init__.py
│   ├── router.py              # APIRouter
│   ├── service.py             # 비즈니스 로직
│   ├── repository.py          # DB 접근
│   ├── models.py              # SQLAlchemy ORM
│   └── schemas.py             # Pydantic
├── order/
│   ├── ...
└── common/
    ├── pagination.py
    └── ...
tests/
├── user/
│   └── test_service.py
pyproject.toml
```

- 도메인별 패키지 — 레이어별(`routers/`, `services/`)보다 응집력 높음
- 공유할 게 명확해지면 `common/` 으로 올림 (섣부른 공통화 금지)

## 레이어

```
Router → Service → Repository
   ↓        ↓          ↓
 Schema   Domain     Model (ORM)
```

- **Router**: HTTP 관심사만, 비즈니스 로직 금지
- **Service**: 트랜잭션 경계, 도메인 규칙
- **Repository**: DB 접근만
- **Router → Repository 직접 호출 금지** — Service 경유

## Settings: pydantic-settings

```python
# config.py
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    
    database_url: PostgresDsn
    jwt_secret: SecretStr
    jwt_expiration_minutes: int = 15
    environment: Literal["local", "dev", "prod"] = "local"

settings = Settings()  # 전역 싱글톤
```

- **타입 안전 환경변수** — 기동 시점에 검증
- `SecretStr` 로 로그에서 자동 마스킹

## 의존성 관리: uv 또는 Poetry

**uv 권장** (2026 기준 표준화): 빠르고 Python 네이티브

```toml
# pyproject.toml
[project]
name = "my-api"
requires-python = ">=3.12"
dependencies = [
    "fastapi>=0.110",
    "uvicorn[standard]>=0.27",
    "sqlalchemy[asyncio]>=2.0",
    "asyncpg>=0.29",
    "pydantic-settings>=2.2",
]

[tool.uv]
dev-dependencies = [
    "pytest>=8.0",
    "pytest-asyncio>=0.23",
    "httpx>=0.27",
    "ruff>=0.3",
    "mypy>=1.9",
]
```

## SQLAlchemy 2.0 비동기 스타일

```python
# database.py
from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker
from sqlalchemy.orm import DeclarativeBase

class Base(DeclarativeBase):
    pass

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
AsyncSessionLocal = async_sessionmaker(engine, expire_on_commit=False)

async def get_db() -> AsyncIterator[AsyncSession]:
    async with AsyncSessionLocal() as session:
        yield session
```

- `expire_on_commit=False` — 응답 직렬화 중 지연 로딩 방지
- `pool_pre_ping=True` — stale 연결 자동 복구

## 애플리케이션 팩토리

```python
# main.py
from fastapi import FastAPI
from .user.router import router as user_router

def create_app() -> FastAPI:
    app = FastAPI(title="My API", version="1.0.0")
    
    app.include_router(user_router)
    app.include_router(order_router)
    
    app.add_exception_handler(ProblemException, problem_handler)
    
    return app

app = create_app()
```

- 테스트에서 다른 설정으로 앱 재생성 가능

## 미들웨어

```python
from fastapi import Request
import time

@app.middleware("http")
async def add_timing(request: Request, call_next):
    start = time.perf_counter()
    response = await call_next(request)
    duration_ms = (time.perf_counter() - start) * 1000
    response.headers["X-Response-Time-Ms"] = f"{duration_ms:.1f}"
    return response
```

- 미들웨어 순서: 에러 → 인증 → 로깅 → CORS (프레임워크 문서 확인)

## 비동기 시작/종료

```python
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app: FastAPI):
    # startup
    await redis.initialize()
    yield
    # shutdown
    await redis.close()
    await engine.dispose()

app = FastAPI(lifespan=lifespan)
```

- `@app.on_event("startup")` 는 deprecated

## 타입 검사

```toml
# pyproject.toml
[tool.mypy]
strict = true
plugins = ["pydantic.mypy"]
```

- **strict 모드** 권장
- CI에서 `mypy app/` 필수

## 포매터·린터

- **ruff** 로 통합 (flake8, isort, black 대체)
  ```toml
  [tool.ruff]
  line-length = 100
  target-version = "py312"
  
  [tool.ruff.lint]
  select = ["E", "F", "I", "B", "UP", "SIM", "RUF"]
  ```

## 네이밍

| 종류 | 규칙 | 예 |
|------|------|---|
| 모듈·패키지 | snake_case | `user_service.py` |
| 클래스 | PascalCase | `UserService` |
| 함수·변수 | snake_case | `find_by_email` |
| 상수 | UPPER_SNAKE | `MAX_RETRY` |
| Pydantic 모델 | PascalCase 접미사 | `UserCreate`, `UserResponse` |
| ORM 모델 | PascalCase | `User`, `Order` |

## 의존성 순환 방지

- 도메인 간 직접 참조 금지 (`user` 가 `order` 를 import 하지 말 것)
- 필요하면 **이벤트** 또는 **공통 인터페이스** 경유

## 금지 사항

- 전역 상태 변경 — 테스트 깨짐, 동시성 이슈
- `from module import *`
- 타입 힌트 없는 public 함수
- 라우트 함수에 DB 쿼리 직접
- 동기 라이브러리를 async 함수 안에서 blocking 사용
