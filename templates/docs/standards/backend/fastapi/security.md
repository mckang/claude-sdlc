# FastAPI — 보안 표준

**기준 버전**: FastAPI 0.110+ / python-jose 또는 authlib / passlib[argon2]
**최종 갱신**: 2026-04

## 인증 전략

| 상황 | 권장 |
|------|------|
| SPA 동일 도메인 | HttpOnly 쿠키 세션 |
| SPA 별도 도메인 | access token in memory + refresh in HttpOnly 쿠키 |
| 모바일·서버-서버 | Bearer JWT |
| 내부 서비스 | mTLS 또는 짧은 JWT |

## JWT 예

```python
from jose import jwt
from datetime import datetime, timedelta, timezone

def create_access_token(user_id: str) -> str:
    payload = {
        "sub": user_id,
        "iat": datetime.now(timezone.utc),
        "exp": datetime.now(timezone.utc) + timedelta(minutes=15),
    }
    return jwt.encode(payload, settings.jwt_secret.get_secret_value(), algorithm="RS256")

async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: AsyncSession = Depends(get_db),
) -> User:
    try:
        payload = jwt.decode(token, settings.jwt_public_key, algorithms=["RS256"])
    except JWTError:
        raise ProblemException(401, "Invalid Token")
    user = await session.get(User, payload["sub"])
    if not user:
        raise ProblemException(401, "Invalid Token")
    return user
```

- **RS256 권장** (공개키 검증만 하는 서비스가 많을 때 유리)
- **`alg=none` 절대 금지**

## 비밀번호 해싱

```python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["argon2"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
```

- **Argon2id** 우선, bcrypt는 legacy 호환 시만
- 평문·MD5·SHA1 금지

## 입력 검증: Pydantic

```python
from pydantic import BaseModel, EmailStr, Field, field_validator

class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=10, max_length=128)
    username: str = Field(pattern=r"^[a-zA-Z0-9_]+$")
    
    @field_validator("password")
    @classmethod
    def password_complexity(cls, v):
        if not any(c.isdigit() for c in v) or not any(c.isalpha() for c in v):
            raise ValueError("영문자와 숫자 모두 포함")
        return v
```

- **경계에서 반드시 검증** — 내부 함수 간 전달은 타입만으로 충분

## SQL 인젝션 방어

SQLAlchemy 2.0 사용 시 파라미터 바인딩 자동:

```python
# ✅ OK
stmt = select(User).where(User.email == email_input)

# ✅ OK (named parameter)
result = await session.execute(
    text("SELECT * FROM users WHERE email = :email"),
    {"email": email_input}
)

# ❌ 금지
result = await session.execute(text(f"SELECT * FROM users WHERE email = '{email_input}'"))
```

## 비밀 관리

- `Settings`의 `SecretStr` 로 로그 마스킹
- `.env` 는 `.gitignore`, `.env.example` 만 커밋
- 프로덕션: AWS Secrets Manager / Vault / K8s Secret

```python
class Settings(BaseSettings):
    jwt_secret: SecretStr
    db_password: SecretStr
    
    model_config = SettingsConfigDict(env_file=".env")
```

## CORS

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://app.example.com"],  # 화이트리스트 only
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE"],
    allow_headers=["Authorization", "Content-Type"],
)
```

- `allow_origins=["*"]` 프로덕션 금지
- `allow_credentials=True` 와 `*` 는 동시 사용 불가

## Rate Limiting

**slowapi** 또는 **fastapi-limiter** (Redis 기반):

```python
from fastapi_limiter import FastAPILimiter
from fastapi_limiter.depends import RateLimiter

@app.on_event("startup")
async def startup():
    await FastAPILimiter.init(redis)

@router.post("/login", dependencies=[Depends(RateLimiter(times=5, seconds=60))])
async def login(...):
    ...
```

- 인증 엔드포인트는 특히 엄격히
- 429 + `Retry-After` 헤더

## 인가 (Authorization)

```python
# 역할 기반
def require_role(role: str):
    async def checker(user: User = Depends(get_current_user)):
        if role not in user.roles:
            raise ProblemException(403, "Forbidden")
        return user
    return checker

@router.delete("/admin/users/{id}")
async def admin_delete(id: int, _: User = Depends(require_role("admin"))):
    ...
```

- **IDOR 방어**: 소유자 검증 필수
  ```python
  order = await order_repo.find_by_id_and_owner(order_id, current_user.id)
  if not order:
      raise ProblemException(404, "Not Found")  # 403 대신 404 — 존재 여부도 노출 X
  ```

## 보안 헤더

```python
from starlette.middleware.base import BaseHTTPMiddleware

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response
```

- HTTPS 환경이면 HSTS 헤더 추가
- CSP 는 정적 자원 서빙할 때 필요

## 의존성 취약점

- **pip-audit** 또는 **safety** CI에 추가
  ```bash
  pip-audit
  ```
- Dependabot/Renovate 활성화

## 로그에 민감정보 금지

- Pydantic `SecretStr` 사용
- 구조화 로거 (structlog/loguru) 에서 필드 필터링
- 예외 메시지에 사용자 입력 그대로 포함 금지

## OAuth 제공자 통합

- **Authlib** 권장 (표준 준수)
- state 파라미터 검증 필수 (CSRF 방어)
- redirect_uri 화이트리스트

## 금지 사항

- `alg=none` JWT
- 비밀번호를 응답·로그에 노출
- 사용자 입력을 그대로 URL redirect (open redirect)
- SQL 문자열 포매팅 (`f"...{input}..."`)
- `eval()`, `exec()`, `pickle.loads()` (신뢰 안 되는 데이터에)
- 디버그 모드(`FastAPI(debug=True)`) 프로덕션 배포
