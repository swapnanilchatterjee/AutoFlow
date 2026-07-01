"""Telegram channel — sends via the Bot API.

Setup: create a bot with @BotFather to get a token. Each recipient is a chat
id or an @channel_username the bot can post to.
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

_PARSE_MODE = {"markdown": "Markdown", "html": "HTML"}


class TelegramChannel(Channel):
    type = "telegram"
    label = "Telegram"
    supports_attachments = True
    supports_subject = False
    supports_html = True
    send_hint = "to (chat id or @channel), body, format (text|markdown|html), attachments"
    config_fields = [
        ConfigField(
            "bot_token", "Bot token", secret=True,
            placeholder="123456:ABC-DEF...", help="Token from @BotFather.",
        ),
    ]

    def __init__(self, config: dict[str, str], *, http_post: HttpPost = default_http_post) -> None:
        self.bot_token = config["bot_token"]
        self._post = http_post

    @property
    def _base(self) -> str:
        return f"https://api.telegram.org/bot{self.bot_token}"

    def _text_with_subject(self, message: OutboundMessage) -> str:
        if message.subject:
            return f"{message.subject}\n\n{message.body}"
        return message.body

    def send(self, message: OutboundMessage) -> DeliveryResult:
        parse_mode = _PARSE_MODE.get(message.body_format)
        text = self._text_with_subject(message)
        refs: list[str] = []

        for chat_id in message.recipients:
            if message.attachments:
                for i, att in enumerate(message.attachments):
                    data = {"chat_id": chat_id}
                    if i == 0 and text:
                        data["caption"] = text
                        if parse_mode:
                            data["parse_mode"] = parse_mode
                    files = {"document": (att.filename, att.content, att.mime_type)}
                    refs.append(self._call("sendDocument", data=data, files=files))
            else:
                data = {"chat_id": chat_id, "text": text or " "}
                if parse_mode:
                    data["parse_mode"] = parse_mode
                refs.append(self._call("sendMessage", data=data))

        return DeliveryResult(True, f"Sent to {len(message.recipients)} chat(s)", refs)

    def _call(self, method: str, *, data: dict, files: dict | None = None) -> str:
        resp = self._post(f"{self._base}/{method}", data=data, files=files)
        body = resp.json() or {}
        if not resp.ok or not body.get("ok", False):
            desc = body.get("description") if isinstance(body, dict) else resp.text
            raise ChannelError(f"Telegram {method} failed: {desc or resp.status_code}")
        result = body.get("result", {})
        return str(result.get("message_id", ""))
