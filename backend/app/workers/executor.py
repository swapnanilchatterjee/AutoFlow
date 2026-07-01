"""Workflow run executor (Phases 9 & 10).

Runs inside a Celery worker (synchronous context). Given a ``WorkflowRun`` id
it: marks the run running, executes each step as a shell command inside the
workspace working tree with secrets/variables injected as environment
variables, streams combined stdout/stderr into the step's ``logs`` (committing
incrementally so the UI can tail them), then marks the run success/failed and
emits a notification.
"""
from __future__ import annotations

import os
import subprocess
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt
from app.core.enums import RunStatus, StepStatus
from app.core.storage import ensure_workspace_dir
from app.models.notification import Notification
from app.models.secret import Secret, Variable
from app.models.workflow import StepRun, Workflow, WorkflowRun
from app.models.workspace import Workspace
from app.workers.parser import WorkflowParseError, parse_workflow

STEP_TIMEOUT_SECONDS = 1800  # 30 min hard cap per step
_LOG_FLUSH_EVERY = 10        # commit logs every N lines


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _build_env(db: Session, workspace_id: uuid.UUID, wf_env: dict[str, str]) -> dict[str, str]:
    """Minimal base env + variables + decrypted secrets + workflow env."""
    env: dict[str, str] = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": os.environ.get("HOME", "/tmp"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "CI": "true",
        "AUTOFLOW": "true",
    }
    for v in db.execute(
        select(Variable).where(Variable.workspace_id == workspace_id)
    ).scalars():
        env[v.key] = v.value
    for s in db.execute(
        select(Secret).where(Secret.workspace_id == workspace_id)
    ).scalars():
        try:
            env[s.key] = decrypt(s.value_encrypted)
        except ValueError:
            continue
    env.update(wf_env)
    return env


def _run_step(
    db: Session,
    step_row: StepRun,
    command: str,
    env: dict[str, str],
    cwd: str,
) -> int:
    """Execute one step, streaming output into ``step_row.logs``. Returns exit code."""
    step_row.status = StepStatus.RUNNING.value
    step_row.started_at = _now()
    db.commit()

    buffer: list[str] = []
    pending = 0
    try:
        proc = subprocess.Popen(
            ["bash", "-eo", "pipefail", "-c", command],
            cwd=cwd,
            env=env,
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
            bufsize=1,
        )
    except OSError as exc:
        step_row.logs += f"$ {command}\nfailed to start: {exc}\n"
        step_row.status = StepStatus.FAILED.value
        step_row.exit_code = 127
        step_row.finished_at = _now()
        db.commit()
        return 127

    step_row.logs += f"$ {command}\n"
    db.commit()
    code = 1
    try:
        assert proc.stdout is not None
        for line in proc.stdout:
            buffer.append(line)
            pending += 1
            if pending >= _LOG_FLUSH_EVERY:
                step_row.logs += "".join(buffer)
                buffer.clear()
                pending = 0
                db.commit()
        code = proc.wait(timeout=STEP_TIMEOUT_SECONDS)
    except subprocess.TimeoutExpired:
        proc.kill()
        buffer.append(f"\n[timed out after {STEP_TIMEOUT_SECONDS}s]\n")
        code = 124
    finally:
        if buffer:
            step_row.logs += "".join(buffer)
        step_row.exit_code = code
        step_row.finished_at = _now()
        step_row.status = (
            StepStatus.SUCCESS.value if code == 0 else StepStatus.FAILED.value
        )
        db.commit()
    return code


def execute_run(db: Session, run_id: uuid.UUID) -> str:
    """Drive a full workflow run. Returns the final run status string."""
    run = db.get(WorkflowRun, run_id)
    if run is None:
        return "missing"
    if run.status == RunStatus.CANCELLED.value:
        return run.status

    workflow = db.get(Workflow, run.workflow_id)
    workspace = db.get(Workspace, run.workspace_id)
    if workflow is None or workspace is None:
        run.status = RunStatus.FAILED.value
        run.error = "Workflow or workspace no longer exists"
        run.finished_at = _now()
        db.commit()
        return run.status

    run.status = RunStatus.RUNNING.value
    run.started_at = _now()
    db.commit()

    cwd = str(ensure_workspace_dir(run.workspace_id))
    step_rows = list(
        db.execute(
            select(StepRun).where(StepRun.run_id == run.id).order_by(StepRun.step_index)
        ).scalars()
    )

    try:
        parsed = parse_workflow(workflow.definition, default_name=workflow.name)
    except WorkflowParseError as exc:
        run.status = RunStatus.FAILED.value
        run.error = f"Definition error: {exc}"
        run.finished_at = _now()
        for sr in step_rows:
            sr.status = StepStatus.SKIPPED.value
        db.commit()
        _notify(db, run, workflow, ok=False)
        return run.status

    env = _build_env(db, run.workspace_id, parsed.env)
    failed = False

    for idx, pstep in enumerate(parsed.steps):
        step_row = step_rows[idx] if idx < len(step_rows) else None
        if step_row is None:
            step_row = StepRun(
                run_id=run.id, name=pstep.name, step_index=idx, command=pstep.run
            )
            db.add(step_row)
            db.commit()

        # Honour cancellation requested between steps.
        db.refresh(run)
        if run.status == RunStatus.CANCELLED.value:
            step_row.status = StepStatus.SKIPPED.value
            db.commit()
            continue

        if failed:
            step_row.status = StepStatus.SKIPPED.value
            db.commit()
            continue

        step_env = {**env, **pstep.env}
        code = _run_step(db, step_row, pstep.run, step_env, cwd)
        if code != 0 and not pstep.continue_on_error:
            failed = True
            run.error = f"Step '{pstep.name}' failed with exit code {code}"

    db.refresh(run)
    if run.status == RunStatus.CANCELLED.value:
        final = RunStatus.CANCELLED.value
    else:
        final = RunStatus.FAILED.value if failed else RunStatus.SUCCESS.value
    run.status = final
    run.finished_at = _now()
    db.commit()
    _notify(db, run, workflow, ok=(final == RunStatus.SUCCESS.value))
    return final


def _notify(db: Session, run: WorkflowRun, workflow: Workflow, *, ok: bool) -> None:
    recipient = run.triggered_by_id
    if recipient is None:
        ws = db.get(Workspace, run.workspace_id)
        recipient = ws.owner_id if ws else None
    if recipient is None:
        return
    status_word = "succeeded" if ok else f"finished: {run.status}"
    db.add(
        Notification(
            user_id=recipient,
            title=f"Run #{run.run_number} of '{workflow.name}' {status_word}",
            message=run.error or "",
            type="success" if ok else "error",
            link=f"/workspaces/{run.workspace_id}/workflows/{workflow.id}/runs/{run.id}",
            workspace_id=run.workspace_id,
        )
    )
    db.commit()
