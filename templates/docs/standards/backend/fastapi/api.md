# FastAPI — API 표준

**기준 버전**: FastAPI 0.110+ / Python 3.12 / Pydantic v2
**최종 갱신**: 2026-04

## URI 설계

- 복수형 명사: `/api/v1/users`, `/api/v1/orders`
- 버전 prefix 필수 (`APIRouter(prefix="/api/v1")`)
- 케밥 케이스: `/api/v1/order-items`
- 동사 금지 (❌ `/getUsers`)

## 기본 구조

```python
from fastapi import APIRouter, Depends, HTTPException, status
from .schemas import UserCreate, UserResponse

router = APIRouter(prefix="/api/v1/users", tags=["users"])

@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    service: UserService = Depends(get_user_service),
) -> UserResponse:
    user = await service.create(payload)
    return user
```

- **타입 힌트 필수** — FastAPI의 검증·문서 생성이 여기서 나옴
- **`response_model` 지정** — 응답 필드 제어 (민감 필드 누수 방지)
- **`async def`** 기본, CPU 바운드만 `def`

## Pydantic v2 스키마

```python
from pydantic import BaseModel, EmailStr, Field, ConfigDict

class UserCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")  # 정의 안 된 필드 오면 422
    
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)
    name: str = Field(min_length=1, max_length=100)

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)  # ORM 객체 → 스키마
    
    id: int
    email: EmailStr
    name: str
    created_at: datetime
```

- **`extra="forbid"`**: 클라이언트가 알 수 없는 필드 보내면 차단 (API 안정성)
- **입력 스키마와 응답 스키마 분리**: `UserCreate`, `UserUpdate`, `UserResponse`

## HTTP 상태 코드

| 동작 | 성공 | 주요 실패 |
|------|------|-----------|
| GET | 200, 404 | — |
| POST (생성) | 201 | 400, 409, 422 |
| PUT/PATCH | 200, 204 | 400, 404, 422 |
| DELETE | 204 | 404 |

- **422 Unprocessable Entity**: FastAPI 기본 검증 실패 (Pydantic)
- **400 Bad Request**: 비즈니스 규칙 위반

## 에러 응답: RFC 7807

```python
# app/exceptions.py
from fastapi import Request
from fastapi.responses import JSONResponse

class ProblemException(Exception):
    def __init__(self, status: int, title: str, detail: str | None = None):
        self.status = status
        self.title = title
        self.detail = detail

async def problem_handler(request: Request, exc: ProblemException):
    return JSONResponse(
        status_code=exc.status,
        media_type="application/problem+json",
        content={
            "type": f"https://api.example.com/errors/{exc.title.lower().replace(' ', '-')}",
            "title": exc.title,
            "status": exc.status,
            "detail": exc.detail,
            "instance": str(request.url),
        },
    )

# main.py
app.add_exception_handler(ProblemException, problem_handler)
```

## 페이지네이션

- cursor 기반 선호:
  ```python
  class PaginatedResponse(BaseModel, Generic[T]):
      items: list[T]
      next_cursor: str | None = None
  ```
- 커서는 base64(JSON) — `{"id": 123}` 같은 구조를 인코딩

## 의존성 주입

FastAPI의 핵심 기능 — 적극 활용:

```python
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db_session),
) -> User:
    payload = decode_jwt(token)
    user = await session.get(User, payload["sub"])
    if not user:
        raise ProblemException(401, "Invalid Token")
    return user

@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> UserResponse:
    return user
```

- **인증·DB 세션·설정** 모두 `Depends`로
- 테스트 시 `app.dependency_overrides`로 쉽게 교체

## 비동기 주의사항

- **`async def` 안에서 동기 블로킹 호출 금지** — 이벤트 루프 점유
  - `requests` → `httpx`
  - `psycopg2` → `asyncpg` or `psycopg3` async
  - CPU 바운드는 `run_in_threadpool` or `run_in_executor`

```python
from fastapi.concurrency import run_in_threadpool

@router.post("/reports")
async def create_report(...):
    result = await run_in_threadpool(heavy_cpu_work, data)
    return result
```

## 멱등성

```python
@router.post("/orders")
async def create_order(
    payload: OrderCreate,
    idempotency_key: str | None = Header(None, alias="Idempotency-Key"),
    redis: Redis = Depends(get_redis),
):
    if idempotency_key:
        cached = await redis.get(f"idem:{idempotency_key}")
        if cached:
            return json.loads(cached)
    # ... 처리
```

## OpenAPI 문서

FastAPI는 기본으로 `/docs`, `/redoc` 자동 생성. 품질 높이려면:

- 각 라우터 `tags=[...]` 로 그룹화
- `summary`, `description`, `response_description` 채우기
- `examples`로 예시 제공
- 민감 엔드포인트는 `include_in_schema=False`

## 파일 업로드

```python
from fastapi import UploadFile, File

@router.post("/avatar")
async def upload_avatar(file: UploadFile = File(..., max_length=5*1024*1024)):
    if file.content_type not in {"image/jpeg", "image/png"}:
        raise ProblemException(415, "Unsupported Media Type")
    # ... 처리
```

- **큰 파일은 S3 presigned URL 패턴** — 서버 거치지 말고 직접 업로드

## 금지 사항

- 라우트 함수에 비즈니스 로직 — 서비스 계층으로
- `response_model` 없이 엔티티 직접 반환 — 민감 필드 누수
- `dict` 또는 `Any`를 타입으로 — Pydantic 모델
- `async def` 안에서 동기 블로킹 I/O
- 응답 공통 래퍼 (`{"code": 0, "data": ...}`) — HTTP 상태코드 활용
- 쿼리 파라미터에 비밀정보
