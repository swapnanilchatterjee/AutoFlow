"""Authentication endpoints (Phase 2)."""
from fastapi import APIRouter, Depends
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.models.user import User
from app.schemas.auth import RefreshRequest, RegisterRequest, Token
from app.schemas.user import UserRead
from app.services.auth_service import AuthService

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/register", response_model=UserRead, status_code=201)
async def register(data: RegisterRequest, db: AsyncSession = Depends(get_db)) -> User:
    """Create an account. The very first account becomes the platform admin."""
    return await AuthService(db).register(data)


@router.post("/login", response_model=Token)
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: AsyncSession = Depends(get_db),
) -> Token:
    """Exchange username/email + password for access & refresh tokens."""
    svc = AuthService(db)
    user = await svc.authenticate(form.username, form.password)
    return svc.issue_tokens(user)


@router.post("/refresh", response_model=Token)
async def refresh(data: RefreshRequest, db: AsyncSession = Depends(get_db)) -> Token:
    return await AuthService(db).refresh(data.refresh_token)


@router.get("/me", response_model=UserRead)
async def me(user: User = Depends(get_current_user)) -> User:
    return user
