"""Workflow run executor (Phases 9 & 10).

Runs inside a Celery worker (synchronous context). Given a ``WorkflowRun`` id
it: marks the run running, executes each step as a shell command inside the
workspace working tree with secrets/variables injected as environment
variables, streams combined stdout/stderr into the step's ``logs`` (committing
incrementally so the UI can tail them), then marks the run success/failed and
emits a notification.
"""
from __future__ import annotations

import json
import os
import subprocess
import uuid
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.crypto import decrypt
from app.core.enums import RunStatus, StepStatus
from app.core.storage import ensure_workspace_dir
from app.integrations.base import ChannelError
from app.integrations.compose import compose_message
from app.integrations.registry import build_channel
from app.models.connection import Connection
from app.models.delivery import Delivery
from app.models.notification import Notification
from app.models.secret import Secret, Variable
from app.models.workflow import StepRun, Workflow, WorkflowRun
from app.models.workspace import Workspace
from app.schemas.delivery import DELIVERED, EXECUTING, FAILED
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


def _fmt_size(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / (1024 * 1024):.1f} MB"


def _resolve_channel(
    db: Session, workspace_id: uuid.UUID, channel_type: str, name: str | None
):
    stmt = select(Connection).where(
        Connection.workspace_id == workspace_id,
        Connection.type == channel_type,
        Connection.enabled.is_(True),
    )
    if name:
        stmt = stmt.where(Connection.name == name)
    conns = list(db.execute(stmt).scalars())
    if not conns:
        hint = f" named '{name}'" if name else ""
        raise ChannelError(
            f"No enabled {channel_type} connection{hint} configured for this workspace. "
            f"Add one under the workspace's Integrations settings."
        )
    conn = conns[0]
    config = json.loads(decrypt(conn.config_encrypted))
    return conn, build_channel(channel_type, config)


def _delivery_display(pstep) -> tuple[str, int, str, str | None]:
    """Best-effort recipients / attachment count / format / subject from a raw step."""
    to = pstep.with_.get("to")
    if isinstance(to, list):
        recips = ", ".join(str(x) for x in to)
    elif to:
        recips = str(to)
    else:
        recips = ""
    atts = pstep.with_.get("attachments")
    n_att = len(atts) if isinstance(atts, list) else (1 if atts else 0)
    fmt = str(pstep.with_.get("format", "text"))
    subj = pstep.with_.get("subject")
    return recips, n_att, fmt, (str(subj) if subj else None)


def _new_delivery(run, workflow, pstep, step_name: str, *, status: str, **extra) -> Delivery:
    recips, n_att, fmt, subj = _delivery_display(pstep)
    return Delivery(
        workspace_id=run.workspace_id,
        workflow_id=workflow.id,
        run_id=run.id,
        run_number=run.run_number,
        workflow_name=workflow.name,
        step_name=step_name,
        channel=pstep.uses,
        connection_name=str(pstep.with_.get("connection") or ""),
        recipients=recips,
        recipient_count=len([r for r in recips.split(",") if r.strip()]),
        body_format=fmt,
        subject=subj,
        attachment_count=n_att,
        status=status,
        started_at=_now(),
        **extra,
    )


def _run_action(db: Session, step_row: StepRun, pstep, env: dict[str, str], run, workflow) -> int:
    """Execute a ``uses:`` action step (deliver a message). Returns exit code.

    Records a Delivery row (executing → delivered / failed) so the send shows up in
    the Delivery log. The message body is intentionally NOT written to the logs (it may
    contain substituted secret values); only delivery metadata is recorded.
    """
    workspace_id = run.workspace_id
    step_row.status = StepStatus.RUNNING.value
    step_row.started_at = _now()
    db.commit()

    lines: list[str] = []
    delivery: Delivery | None = None
    try:
        conn, channel = _resolve_channel(
            db, workspace_id, pstep.uses, pstep.with_.get("connection")
        )
        message = compose_message(pstep.with_, env, workspace_id, pstep.uses)

        delivery = _new_delivery(run, workflow, pstep, step_row.name, status=EXECUTING)
        delivery.connection_name = conn.name
        delivery.recipients = ", ".join(message.recipients)
        delivery.recipient_count = len(message.recipients)
        delivery.body_format = message.body_format
        delivery.subject = message.subject
        delivery.attachment_count = len(message.attachments)
        db.add(delivery)
        db.commit()

        lines.append(f"→ {pstep.uses} via connection '{conn.name}'")
        lines.append(f"  to: {', '.join(message.recipients)}")
        if message.subject:
            lines.append(f"  subject: {message.subject}")
        if message.attachments:
            lines.append(
                "  attachments: "
                + ", ".join(f"{a.filename} ({_fmt_size(a.size)})" for a in message.attachments)
            )
        result = channel.send(message)
        refs = ", ".join(r for r in result.provider_refs if r)
        lines.append(f"✓ {result.summary}")
        if refs:
            lines.append(f"  refs: {refs}")

        delivery.status = DELIVERED
        delivery.detail = result.summary
        delivery.provider_refs = refs or None
        delivery.finished_at = _now()

        step_row.logs += "\n".join(lines) + "\n"
        step_row.exit_code = 0
        step_row.status = StepStatus.SUCCESS.value
        step_row.finished_at = _now()
        db.commit()
        return 0
    except ChannelError as exc:
        lines.append(f"✗ {exc}")
        if delivery is None:
            delivery = _new_delivery(
                run, workflow, pstep, step_row.name,
                status=FAILED, detail=str(exc), finished_at=_now(),
            )
            db.add(delivery)
        else:
            delivery.status = FAILED
            delivery.detail = str(exc)
            delivery.finished_at = _now()
        step_row.logs += "\n".join(lines) + "\n"
        step_row.exit_code = 1
        step_row.status = StepStatus.FAILED.value
        step_row.finished_at = _now()
        db.commit()
        return 1


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
        if pstep.is_action:
            code = _run_action(db, step_row, pstep, step_env, run, workflow)
        else:
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
    ws = db.get(Workspace, run.workspace_id)
    if recipient is None:
        recipient = ws.owner_id if ws else None
    if recipient is not None:
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

    if not ok and ws:
        owner_id = ws.owner_id
        if owner_id:
            from app.models.user import User
            owner = db.get(User, owner_id)
            if owner and owner.email:
                # Find an enabled gmail connection in the workspace
                stmt = select(Connection).where(
                    Connection.workspace_id == run.workspace_id,
                    Connection.type == "gmail",
                    Connection.enabled.is_(True)
                )
                conn = db.execute(stmt).scalars().first()
                if conn:
                    from app.integrations.base import OutboundMessage
                    from app.services.connection_service import _decrypt_config
                    from app.core.logging import logger
                    try:
                        decrypted = _decrypt_config(conn)
                        channel = build_channel("gmail", decrypted)
                        subject = f"⚠️ AutoFlow Alert: Workflow '{workflow.name}' Failed"
                        body = (
                            f"Hello Admin,\n\n"
                            f"This is an automated alert that workflow '{workflow.name}' (Run #{run.run_number}) "
                            f"failed in workspace '{ws.slug}'.\n\n"
                            f"Error details:\n{run.error or 'Unknown error'}\n\n"
                            f"You can view the run logs here: http://localhost:5173/workspaces/{run.workspace_id}/workflows/{workflow.id}/runs/{run.id}\n"
                        )
                        msg = OutboundMessage(
                            recipients=[owner.email],
                            subject=subject,
                            body=body,
                            body_format="text",
                            attachments=[]
                        )
                        channel.send(msg)
                        logger.info("Admin email failure alert sent to %s", owner.email)
                    except Exception as exc:
                        logger.error("Failed to send admin email alert: %s", exc)
