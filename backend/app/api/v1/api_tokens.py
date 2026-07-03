import uuid
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user
from app.core.database import get_db
from app.core.exceptions import NotFoundError, UnauthorizedError
from app.models.user import User
from app.repositories.api_token import ApiTokenRepository
from app.schemas.api_token import ApiTokenCreate, ApiTokenCreated, ApiTokenRead
from app.schemas.auth import Token
from app.services.auth_service import AuthService

router = APIRouter(tags=["api-tokens"])


class ExchangeTokenRequest(BaseModel):
    token: str


@router.get("/api-tokens", response_model=list[ApiTokenRead])
async def list_api_tokens(
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> list[ApiTokenRead]:
    repo = ApiTokenRepository(db)
    tokens = await repo.list_for_user(user.id)
    result: list[ApiTokenRead] = []
    for t in tokens:
        data = ApiTokenRead.model_validate(t)
        data.token_prefix = t.token[:8] + "..."
        result.append(data)
    return result


@router.post("/api-tokens", response_model=ApiTokenCreated, status_code=201)
async def create_api_token(
    data: ApiTokenCreate,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ApiTokenCreated:
    repo = ApiTokenRepository(db)
    token = await repo.create(user.id, data.name)
    return ApiTokenCreated.model_validate(token)


@router.delete("/api-tokens/{token_id}", status_code=204)
async def revoke_api_token(
    token_id: uuid.UUID,
    user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> None:
    repo = ApiTokenRepository(db)
    token = await repo.get(token_id)
    if token is None:
        raise NotFoundError("API token not found")
    if token.user_id != user.id and not user.is_superuser:
        raise UnauthorizedError("Not authorized to revoke this token")
    await repo.delete(token.id)


@router.post("/auth/api-token", response_model=Token)
async def exchange_api_token(
    data: ExchangeTokenRequest,
    db: AsyncSession = Depends(get_db),
) -> Token:
    repo = ApiTokenRepository(db)
    token_obj = await repo.get_by_token(data.token)
    if token_obj is None:
        raise UnauthorizedError("Invalid API token")

    if token_obj.expires_at and token_obj.expires_at.replace(tzinfo=None) < datetime.now(UTC).replace(tzinfo=None):
        raise UnauthorizedError("API token has expired")

    await repo.touch(token_obj.id)

    user = await db.get(User, token_obj.user_id)
    if user is None or not user.is_active:
        raise UnauthorizedError("User not found or disabled")

    svc = AuthService(db)
    return svc.issue_tokens(user)
