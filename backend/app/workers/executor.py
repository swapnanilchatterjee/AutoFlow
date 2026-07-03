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
_LOG_FLUSH_EVERY = 10  # commit logs every N lines


def _now() -> str:
    return datetime.now(UTC).isoformat()


def _build_env(db: Session, workspace_id: uuid.UUID, wf_env: dict[str, str], run: WorkflowRun | None = None) -> dict[str, str]:
    """Minimal base env + variables + decrypted secrets + workflow env."""
    env: dict[str, str] = {
        "PATH": os.environ.get("PATH", "/usr/local/bin:/usr/bin:/bin"),
        "HOME": os.environ.get("HOME", "/tmp"),
        "LANG": os.environ.get("LANG", "C.UTF-8"),
        "CI": "true",
        "AUTOFLOW": "true",
    }
    for v in db.execute(select(Variable).where(Variable.workspace_id == workspace_id)).scalars():
        env[v.key] = v.value
    for s in db.execute(select(Secret).where(Secret.workspace_id == workspace_id)).scalars():
        try:
            env[s.key] = decrypt(s.value_encrypted)
        except ValueError:
            continue
    env.update(wf_env)

    if run and run.trigger == "auto-restart-alt":
        try:
            workflow = db.get(Workflow, run.workflow_id)
            if workflow:
                parsed = parse_workflow(workflow.definition, default_name=workflow.name)
                sh = parsed.self_healing
                if sh and sh.get("alternate_sources"):
                    alts = sh.get("alternate_sources")
                    if isinstance(alts, dict):
                        env.update(alts)
                    elif isinstance(alts, list):
                        for alt in alts:
                            if isinstance(alt, dict) and "key" in alt and "value" in alt:
                                env[alt["key"]] = alt["value"]
        except Exception:
            pass

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
        step_row.status = StepStatus.SUCCESS.value if code == 0 else StepStatus.FAILED.value
        db.commit()
    return code


def _fmt_size(n: int) -> str:
    if n < 1024:
        return f"{n} B"
    if n < 1024 * 1024:
        return f"{n / 1024:.1f} KB"
    return f"{n / (1024 * 1024):.1f} MB"


def _resolve_channel(db: Session, workspace_id: uuid.UUID, channel_type: str, name: str | None):
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
        from app.integrations.registry import get_channel_class
        channel_cls = get_channel_class(pstep.uses)
        has_config = len(channel_cls.config_fields) > 0

        if has_config:
            conn, channel = _resolve_channel(
                db, workspace_id, pstep.uses, pstep.with_.get("connection")
            )
            conn_name = conn.name
        else:
            conn = None
            conn_name = ""
            channel = build_channel(pstep.uses, {})

        message = compose_message(pstep.with_, env, workspace_id, pstep.uses)

        delivery = _new_delivery(run, workflow, pstep, step_row.name, status=EXECUTING)
        delivery.connection_name = conn_name
        delivery.recipients = ", ".join(message.recipients)
        delivery.recipient_count = len(message.recipients)
        delivery.body_format = message.body_format
        delivery.subject = message.subject
        delivery.attachment_count = len(message.attachments)
        db.add(delivery)
        db.commit()

        if conn_name:
            lines.append(f"→ {pstep.uses} via connection '{conn_name}'")
        else:
            lines.append(f"→ {pstep.uses}")
        if message.recipients:
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
                run,
                workflow,
                pstep,
                step_row.name,
                status=FAILED,
                detail=str(exc),
                finished_at=_now(),
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


def _evaluate_condition(
    condition: str,
    env: dict[str, str],
    workspace_id: uuid.UUID,
    steps_status: list[str]
) -> bool:
    if not condition:
        return True

    from app.core.storage import safe_join
    import re

    def _subst_val(text: str, env_dict: dict[str, str]) -> str:
        VAR_RE = re.compile(r"\$\{(\w+)\}")
        return VAR_RE.sub(lambda m: env_dict.get(m.group(1), m.group(0)), text)

    def file_size(p: str) -> int:
        try:
            p_sub = _subst_val(p, env)
            path = safe_join(workspace_id, p_sub)
            if path.is_file():
                return path.stat().st_size
        except Exception:
            pass
        return 0

    def file_exists(p: str) -> bool:
        try:
            p_sub = _subst_val(p, env)
            return safe_join(workspace_id, p_sub).is_file()
        except Exception:
            return False

    def line_count(p: str) -> int:
        try:
            p_sub = _subst_val(p, env)
            path = safe_join(workspace_id, p_sub)
            if path.is_file():
                with open(path, "r", errors="ignore") as f:
                    return sum(1 for _ in f)
        except Exception:
            pass
        return 0

    def success() -> bool:
        return all(s in {StepStatus.SUCCESS.value, "success"} for s in steps_status)

    def failure() -> bool:
        return any(s in {StepStatus.FAILED.value, "failed"} for s in steps_status)

    eval_globals = {
        "file_size": file_size,
        "file_exists": file_exists,
        "line_count": line_count,
        "success": success,
        "failure": failure,
        "env": env,
        "True": True,
        "False": False,
    }

    cond_clean = condition.strip()
    if cond_clean == "success":
        cond_clean = "success()"
    elif cond_clean == "failure":
        cond_clean = "failure()"

    try:
        result = eval(cond_clean, {"__builtins__": None}, eval_globals)
        return bool(result)
    except Exception as exc:
        from app.core.logging import logger
        logger.error(f"Error evaluating condition '{condition}': {exc}")
        return False


def _trigger_fallback(db: Session, run: WorkflowRun, fallback_slug: str) -> None:
    from app.core.logging import logger
    fallback_wf = db.execute(
        select(Workflow).where(
            Workflow.workspace_id == run.workspace_id,
            Workflow.slug == fallback_slug
        )
    ).scalars().first()
    
    if not fallback_wf:
        logger.warning(f"Fallback workflow '{fallback_slug}' not found in workspace {run.workspace_id}")
        return
        
    if not fallback_wf.enabled:
        logger.warning(f"Fallback workflow '{fallback_slug}' is disabled")
        return

    try:
        parsed = parse_workflow(fallback_wf.definition, default_name=fallback_wf.name)
    except Exception as exc:
        logger.error(f"Failed to parse fallback workflow definition: {exc}")
        return

    from sqlalchemy import func
    stmt = select(func.coalesce(func.max(WorkflowRun.run_number), 0)).where(WorkflowRun.workflow_id == fallback_wf.id)
    max_num = db.execute(stmt).scalar() or 0
    number = max_num + 1

    fallback_run = WorkflowRun(
        workflow_id=fallback_wf.id,
        workspace_id=fallback_wf.workspace_id,
        run_number=number,
        status=RunStatus.QUEUED.value,
        trigger="fallback",
        triggered_by_id=run.triggered_by_id,
    )
    db.add(fallback_run)
    db.commit()

    for idx, step in enumerate(parsed.steps):
        db.add(
            StepRun(run_id=fallback_run.id, name=step.name, step_index=idx, command=step.command_display)
        )
    db.commit()

    from app.workers.tasks import run_workflow
    async_result = run_workflow.delay(str(fallback_run.id))
    fallback_run.celery_task_id = async_result.id
    db.commit()
    logger.info(f"Triggered fallback workflow '{fallback_wf.name}' run #{number}")


def _handle_self_healing(db: Session, run: WorkflowRun, parsed_wf) -> None:
    from app.core.logging import logger
    sh = parsed_wf.self_healing
    if not sh or not sh.get("auto_restart"):
        return

    max_restarts = int(sh.get("max_restarts", 3))
    
    # Count consecutive failures of this workflow
    stmt = select(WorkflowRun).where(
        WorkflowRun.workflow_id == run.workflow_id
    ).order_by(WorkflowRun.run_number.desc()).limit(max_restarts + 2)
    recent = list(db.execute(stmt).scalars())

    consec_failures = 0
    for r in recent:
        if r.status == RunStatus.FAILED.value:
            consec_failures += 1
        else:
            break

    if consec_failures < max_restarts:
        from sqlalchemy import func
        stmt = select(func.coalesce(func.max(WorkflowRun.run_number), 0)).where(WorkflowRun.workflow_id == run.workflow_id)
        max_num = db.execute(stmt).scalar() or 0
        number = max_num + 1

        trigger_name = "auto-restart"
        if sh.get("retry_alternate_sources") and consec_failures > 0:
            trigger_name = "auto-restart-alt"

        new_run = WorkflowRun(
            workflow_id=run.workflow_id,
            workspace_id=run.workspace_id,
            run_number=number,
            status=RunStatus.QUEUED.value,
            trigger=trigger_name,
            triggered_by_id=run.triggered_by_id,
        )
        db.add(new_run)
        db.commit()

        for idx, step in enumerate(parsed_wf.steps):
            db.add(
                StepRun(run_id=new_run.id, name=step.name, step_index=idx, command=step.command_display)
            )
        db.commit()

        from app.workers.tasks import run_workflow
        prio_map = {"High": 9, "Medium": 5, "Low": 1}
        workflow = db.get(Workflow, run.workflow_id)
        prio_val = prio_map.get(workflow.priority if workflow else "Medium", 5)
        
        async_result = run_workflow.apply_async(args=[str(new_run.id)], priority=prio_val)
        new_run.celery_task_id = async_result.id
        db.commit()
        logger.info(f"Self-healing: queued auto-restart run #{number} for workflow {run.workflow_id} (failure {consec_failures}/{max_restarts})")


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

    env = _build_env(db, run.workspace_id, parsed.env, run)
    failed = False
    steps_status = []

    for idx, pstep in enumerate(parsed.steps):
        step_row = step_rows[idx] if idx < len(step_rows) else None
        if step_row is None:
            step_row = StepRun(run_id=run.id, name=pstep.name, step_index=idx, command=pstep.run)
            db.add(step_row)
            db.commit()

        # Honour cancellation requested between steps.
        db.refresh(run)
        if run.status == RunStatus.CANCELLED.value:
            step_row.status = StepStatus.SKIPPED.value
            db.commit()
            steps_status.append("skipped")
            continue

        if failed:
            step_row.status = StepStatus.SKIPPED.value
            db.commit()
            steps_status.append("skipped")
            continue

        step_env = {**env, **pstep.env}
        
        # Evaluate step condition
        if pstep.if_:
            should_run = _evaluate_condition(pstep.if_, step_env, run.workspace_id, steps_status)
            if not should_run:
                step_row.status = StepStatus.SKIPPED.value
                db.commit()
                steps_status.append("skipped")
                continue

        if pstep.is_action:
            code = _run_action(db, step_row, pstep, step_env, run, workflow)
        else:
            code = _run_step(db, step_row, pstep.run, step_env, cwd)
            try:
                delivery = Delivery(
                    workspace_id=run.workspace_id,
                    workflow_id=workflow.id,
                    run_id=run.id,
                    run_number=run.run_number,
                    workflow_name=workflow.name,
                    step_name=step_row.name,
                    channel="shell",
                    connection_name="",
                    recipients="",
                    recipient_count=0,
                    body_format="text",
                    subject=pstep.run[:255] if pstep.run else "Shell command",
                    attachment_count=0,
                    status=DELIVERED if code == 0 else FAILED,
                    detail=f"Shell step completed with exit code {code}" if code == 0 else f"Shell step failed with exit code {code}",
                    started_at=step_row.started_at,
                    finished_at=_now(),
                )
                db.add(delivery)
                db.commit()
            except Exception:
                pass
            
        status = "success" if code == 0 else "failed"
        steps_status.append(status)
        
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
    
    if final == RunStatus.FAILED.value:
        _handle_self_healing(db, run, parsed)
        if parsed.fallback_workflow:
            _trigger_fallback(db, run, parsed.fallback_workflow)
        
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

    should_email = not ok
    if should_email and workflow.email_on_failure and ws:
        try:
            parsed = parse_workflow(workflow.definition, default_name=workflow.name)
            sh = parsed.self_healing
            if sh and sh.get("auto_restart"):
                max_restarts = int(sh.get("max_restarts", 3))
                stmt = select(WorkflowRun).where(
                    WorkflowRun.workflow_id == run.workflow_id
                ).order_by(WorkflowRun.run_number.desc()).limit(max_restarts + 2)
                recent = list(db.execute(stmt).scalars())

                consec_failures = 0
                for r in recent:
                    if r.status == RunStatus.FAILED.value:
                        consec_failures += 1
                    else:
                        break

                if consec_failures < max_restarts:
                    should_email = False
        except Exception:
            pass

    if should_email and workflow.email_on_failure and ws:

        from app.models.user import User

        target_user = None
        if run.triggered_by_id:
            target_user = db.get(User, run.triggered_by_id)
        if not target_user and workflow.created_by_id:
            target_user = db.get(User, workflow.created_by_id)
        if not target_user:
            target_user = db.get(User, ws.owner_id)

        if target_user and target_user.email:
            # Find an enabled gmail connection in the workspace
            stmt = select(Connection).where(
                Connection.workspace_id == run.workspace_id,
                Connection.type == "gmail",
                Connection.enabled.is_(True),
            )
            conn = db.execute(stmt).scalars().first()
            if conn:
                from app.core.logging import logger
                from app.integrations.base import OutboundMessage
                from app.integrations.registry import build_channel
                from app.services.connection_service import _decrypt_config

                try:
                    decrypted = _decrypt_config(conn)
                    channel = build_channel("gmail", decrypted)
                    subject = (
                        f"❌ AutoFlow Failure Alert: Workflow '{workflow.name}' "
                        f"(Run #{run.run_number}) Failed"
                    )

                    # Construct step-by-step logs text
                    logs_list = []
                    for step in run.steps:
                        logs_list.append(f"=== Step: {step.name} (Status: {step.status}) ===")
                        logs_list.append(step.logs or "(no logs)")
                        logs_list.append("\n")
                    full_logs = "\n".join(logs_list)

                    body = (
                        f"Hello {target_user.full_name or target_user.username or 'User'},\n\n"
                        f"This is an automated failure report alert that your workflow "
                        f"'{workflow.name}' (Run #{run.run_number}) "
                        f"failed in workspace '{ws.slug}'.\n\n"
                        f"Error Detail:\n{run.error or 'Unknown error'}\n\n"
                        f"--------------------------------------------------\n"
                        f"EXECUTION LOGS:\n"
                        f"--------------------------------------------------\n"
                        f"{full_logs}\n"
                        f"--------------------------------------------------\n\n"
                        f"You can view full run details inside your dashboard here:\n"
                        f"http://localhost:5173/workspaces/{run.workspace_id}/workflows/{workflow.id}/runs/{run.id}\n"
                    )
                    msg = OutboundMessage(
                        recipients=[target_user.email],
                        subject=subject,
                        body=body,
                        body_format="text",
                        attachments=[],
                    )
                    channel.send(msg)
                    logger.info("Workflow failure alert email sent to %s", target_user.email)
                except Exception as exc:
                    logger.error("Failed to send workflow failure alert email: %s", exc)
