"""Public webhook trigger endpoint (Phase 7/8).

Unauthenticated — the secret is the unguessable token embedded in the URL.
"""
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.enums import TriggerType
from app.core.exceptions import ConflictError, NotFoundError
from app.repositories.workflow import WorkflowRepository
from app.services.workflow_service import WorkflowService

router = APIRouter(prefix="/webhooks", tags=["webhooks"])


@router.post("/{token}", status_code=202)
async def trigger_via_webhook(token: str, db: AsyncSession = Depends(get_db)) -> dict:
    wf = await WorkflowRepository(db).get_by_webhook(token)
    if wf is None:
        raise NotFoundError("Unknown webhook token")
    if wf.trigger_type != TriggerType.WEBHOOK.value:
        raise ConflictError("Workflow is not configured for webhook triggers")
    run = await WorkflowService(db).create_run(
        wf, trigger=TriggerType.WEBHOOK.value, user_id=None
    )
    return {"run_id": str(run.id), "run_number": run.run_number, "status": run.status}
