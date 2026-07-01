"""Celery application (worker + beat share this instance)."""
from celery import Celery

from app.core.config import settings

celery_app = Celery(
    "autoflow",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["app.workers.tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    result_expires=3600,
)

# Beat polls every minute and dispatches any due cron-scheduled workflows.
celery_app.conf.beat_schedule = {
    "dispatch-scheduled-workflows": {
        "task": "schedule.dispatch",
        "schedule": 60.0,
    }
}
