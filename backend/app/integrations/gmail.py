"""Gmail channel — sends email over SMTP using a Gmail App Password.

Setup: enable 2-Step Verification on the Google account, then create an
App Password (Google Account → Security → App passwords) and use it here.
"""
from __future__ import annotations

import smtplib
from collections.abc import Callable
from email.message import EmailMessage

from app.integrations.base import (
    Channel,
    ChannelError,
    ConfigField,
    DeliveryResult,
    OutboundMessage,
)

SmtpFactory = Callable[..., smtplib.SMTP]


def _default_smtp(host: str, port: int) -> smtplib.SMTP:
    return smtplib.SMTP_SSL(host, port, timeout=30)


class GmailChannel(Channel):
    type = "gmail"
    label = "Gmail"
    supports_attachments = True
    supports_subject = True
    supports_html = True
    send_hint = "to, subject, body, format (text|html), attachments"
    config_fields = [
        ConfigField("email", "Email address", placeholder="you@example.com"),
        ConfigField(
            "app_password", "Password / App password", secret=True,
            help="App password or login password.",
        ),
        ConfigField(
            "from_name", "Sender name", required=False,
            placeholder="AutoFlow Reports",
        ),
        ConfigField(
            "smtp_server", "SMTP Server", required=False,
            placeholder="smtp.gmail.com",
        ),
        ConfigField(
            "smtp_port", "SMTP Port", required=False,
            placeholder="465 (SSL) or 587 (TLS)",
        ),
    ]

    def __init__(
        self, config: dict[str, str], *, smtp_factory: SmtpFactory = None
    ) -> None:
        self.email = config["email"]
        self.app_password = config["app_password"]
        self.from_name = config.get("from_name") or ""
        self.smtp_server = config.get("smtp_server") or "smtp.gmail.com"
        port_val = config.get("smtp_port")
        self.smtp_port = int(port_val) if port_val else 465
        self._smtp_factory = smtp_factory

    def send(self, message: OutboundMessage) -> DeliveryResult:
        msg = EmailMessage()
        msg["Subject"] = message.subject or "(no subject)"
        msg["From"] = f"{self.from_name} <{self.email}>" if self.from_name else self.email
        msg["To"] = ", ".join(message.recipients)

        if message.body_format == "html":
            msg.set_content("This message requires an HTML-capable email client.")
            msg.add_alternative(message.body, subtype="html")
        else:
            msg.set_content(message.body)

        for att in message.attachments:
            maintype, _, subtype = att.mime_type.partition("/")
            msg.add_attachment(
                att.content,
                maintype=maintype or "application",
                subtype=subtype or "octet-stream",
                filename=att.filename,
            )

        try:
            if self._smtp_factory:
                server = self._smtp_factory(self.smtp_server, self.smtp_port)
            else:
                if self.smtp_port == 465:
                    server = smtplib.SMTP_SSL(self.smtp_server, self.smtp_port, timeout=30)
                else:
                    server = smtplib.SMTP(self.smtp_server, self.smtp_port, timeout=30)
                    server.ehlo()
                    server.starttls()
                    server.ehlo()
            
            with server:
                server.login(self.email, self.app_password)
                server.send_message(msg)
        except smtplib.SMTPAuthenticationError as exc:
            raise ChannelError(
                "SMTP server rejected the credentials — check the address and Password."
            ) from exc
        except OSError as exc:
            raise ChannelError(f"Could not reach SMTP server: {exc}") from exc

        n = len(message.recipients)
        a = len(message.attachments)
        extra = f" with {a} attachment(s)" if a else ""
        return DeliveryResult(True, f"Emailed {n} recipient(s){extra}")
