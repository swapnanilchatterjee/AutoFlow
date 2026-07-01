"""Turn a workflow step's ``with:`` block into an OutboundMessage.

Recipients, subject and body support ``${VAR}`` substitution from the run
environment (variables + workflow env). Attachments are workspace-relative
file paths, resolved safely and read with a total-size cap.
"""
from __future__ import annotations

import mimetypes
import re
import uuid

from app.core.storage import safe_join
from app.integrations.base import Attachment, ChannelError, OutboundMessage

MAX_TOTAL_ATTACHMENT_BYTES = 25 * 1024 * 1024  # 25 MB
_VAR = re.compile(r"\$\{(\w+)\}")


def _subst(text: str, env: dict[str, str]) -> str:
    return _VAR.sub(lambda m: env.get(m.group(1), m.group(0)), text)


def _recipients(value: object, env: dict[str, str], workspace_id: uuid.UUID, channel_type: str | None = None) -> list[str]:
    if value is None:
        raise ChannelError("Missing 'to' (recipient) in the step")
    if isinstance(value, str):
        raw = [_subst(value, env)]
    elif isinstance(value, list):
        raw = [_subst(str(v), env) for v in value]
    else:
        raise ChannelError("'to' must be a string or a list")
    
    out: list[str] = []
    for item in raw:
        out.extend(p.strip() for p in re.split(r"[,\s]+", item) if p.strip())

    # Try loading contacts.json from the workspace
    contacts_data = None
    try:
        from app.core.storage import safe_join
        import json
        contacts_file = safe_join(workspace_id, "contacts.json")
        if contacts_file.is_file():
            contacts_data = json.loads(contacts_file.read_text(encoding="utf-8"))
    except Exception:
        pass

    if not contacts_data or "contacts" not in contacts_data:
        return out

    expanded: list[str] = []
    contacts_list = contacts_data.get("contacts", [])

    for r in out:
        group_name = None
        if r.startswith("@"):
            group_name = r[1:]
        elif r.startswith("group:"):
            group_name = r[6:]
        
        matched_contacts = []
        if group_name:
            matched_contacts = [c for c in contacts_list if group_name in c.get("groups", [])]
        else:
            # Also match if the recipient name matches contact name or group name directly
            matched_contacts = [c for c in contacts_list if c.get("name") == r]
            if not matched_contacts:
                matched_contacts = [c for c in contacts_list if r in c.get("groups", [])]

        if matched_contacts:
            for c in matched_contacts:
                val = None
                if channel_type == "whatsapp":
                    val = c.get("phone")
                elif channel_type == "gmail":
                    val = c.get("email")
                else:
                    val = c.get("email") or c.get("phone")
                if val:
                    expanded.append(val)
        else:
            expanded.append(r)

    if not expanded:
        raise ChannelError("No recipients resolved from 'to'")
    return expanded


def compose_message(
    with_params: dict, env: dict[str, str], workspace_id: uuid.UUID, channel_type: str | None = None
) -> OutboundMessage:
    if not isinstance(with_params, dict):
        raise ChannelError("Step 'with' must be a mapping")

    recipients = _recipients(with_params.get("to"), env, workspace_id, channel_type)

    body_raw = (
        with_params.get("body")
        or with_params.get("text")
        or with_params.get("message")
        or ""
    )
    body = _subst(str(body_raw), env)

    subject = with_params.get("subject")
    subject = _subst(str(subject), env) if subject is not None else None

    fmt = str(with_params.get("format", "text")).lower()
    if fmt not in {"text", "html", "markdown"}:
        raise ChannelError("'format' must be one of: text, html, markdown")

    attachments = _read_attachments(with_params.get("attachments"), workspace_id)

    return OutboundMessage(
        recipients=recipients,
        body=body,
        subject=subject,
        body_format=fmt,
        attachments=attachments,
    )


def _read_attachments(value: object, workspace_id: uuid.UUID) -> list[Attachment]:
    if value is None:
        return []
    paths = [value] if isinstance(value, str) else value
    if not isinstance(paths, list):
        raise ChannelError("'attachments' must be a path or a list of paths")

    total = 0
    out: list[Attachment] = []
    for p in paths:
        rel = str(p).strip()
        if not rel:
            continue
        try:
            abs_path = safe_join(workspace_id, rel)
        except ValueError as exc:
            raise ChannelError(f"Illegal attachment path: {rel}") from exc
        if not abs_path.is_file():
            raise ChannelError(f"Attachment not found: {rel}")
        data = abs_path.read_bytes()
        total += len(data)
        if total > MAX_TOTAL_ATTACHMENT_BYTES:
            raise ChannelError("Attachments exceed the 25 MB total limit")
        mime = mimetypes.guess_type(abs_path.name)[0] or "application/octet-stream"
        out.append(Attachment(filename=abs_path.name, content=data, mime_type=mime))
    return out
