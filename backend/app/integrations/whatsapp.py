"""WhatsApp channel — sends via the WhatsApp Cloud API (Meta / Facebook Graph).

Setup: in Meta for Developers create a WhatsApp app, note the Phone Number ID
and a (permanent) access token. Recipients are phone numbers in international
format, e.g. 919876543210. Text is sent directly; attachments are uploaded to
the Media endpoint and delivered as documents.

Note: outside a 24-hour customer service window, Meta only allows pre-approved
template messages. Free-form text/documents work within an open session.
"""
from __future__ import annotations

from app.integrations.base import (
    Channel,
    ChannelError,
    ConfigField,
    DeliveryResult,
    HttpPost,
    OutboundMessage,
    default_http_post,
)

_GRAPH = "https://graph.facebook.com/v19.0"


class WhatsAppChannel(Channel):
    type = "whatsapp"
    label = "WhatsApp"
    supports_attachments = True
    supports_subject = False
    supports_html = False
    send_hint = "to (phone in intl format), body, attachments"
    config_fields = [
        ConfigField(
            "phone_number_id", "Phone number ID",
            placeholder="1029384756", help="From the WhatsApp app's API setup.",
        ),
        ConfigField("access_token", "Access token", secret=True),
    ]

    def __init__(self, config: dict[str, str], *, http_post: HttpPost = default_http_post) -> None:
        self.phone_number_id = config["phone_number_id"]
        self.access_token = config["access_token"]
        self._post = http_post

    @property
    def _headers(self) -> dict[str, str]:
        return {"Authorization": f"Bearer {self.access_token}"}

    def _text_with_subject(self, message: OutboundMessage) -> str:
        if message.subject:
            return f"*{message.subject}*\n\n{message.body}"
        return message.body

    def send(self, message: OutboundMessage) -> DeliveryResult:
        text = self._text_with_subject(message)
        media_ids = [self._upload(att) for att in message.attachments]
        refs: list[str] = []

        for to in message.recipients:
            if media_ids:
                for i, (mid, att) in enumerate(zip(media_ids, message.attachments, strict=True)):
                    doc: dict = {"id": mid, "filename": att.filename}
                    if i == 0 and text:
                        doc["caption"] = text
                    refs.append(
                        self._message(
                            {"messaging_product": "whatsapp", "to": to,
                             "type": "document", "document": doc}
                        )
                    )
            else:
                refs.append(
                    self._message(
                        {"messaging_product": "whatsapp", "to": to, "type": "text",
                         "text": {"preview_url": False, "body": text or " "}}
                    )
                )

        return DeliveryResult(True, f"Sent to {len(message.recipients)} number(s)", refs)

    def _message(self, payload: dict) -> str:
        url = f"{_GRAPH}/{self.phone_number_id}/messages"
        resp = self._post(url, json=payload, headers=self._headers)
        body = resp.json() or {}
        if not resp.ok:
            raise ChannelError(f"WhatsApp send failed: {_err(body) or resp.status_code}")
        msgs = body.get("messages") if isinstance(body, dict) else None
        return str(msgs[0]["id"]) if msgs else ""

    def _upload(self, att) -> str:
        url = f"{_GRAPH}/{self.phone_number_id}/media"
        files = {"file": (att.filename, att.content, att.mime_type)}
        data = {"messaging_product": "whatsapp", "type": att.mime_type}
        resp = self._post(url, data=data, files=files, headers=self._headers)
        body = resp.json() or {}
        if not resp.ok or "id" not in body:
            raise ChannelError(f"WhatsApp media upload failed: {_err(body) or resp.status_code}")
        return str(body["id"])


def _err(body: object) -> str:
    if isinstance(body, dict) and isinstance(body.get("error"), dict):
        return str(body["error"].get("message", ""))
    return ""
