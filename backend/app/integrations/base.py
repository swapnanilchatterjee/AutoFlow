"""Channel abstractions shared by every messaging integration."""
from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any

# ---------------------------------------------------------------------------
# Message model
# ---------------------------------------------------------------------------


@dataclass
class Attachment:
    filename: str
    content: bytes
    mime_type: str

    @property
    def size(self) -> int:
        return len(self.content)


@dataclass
class OutboundMessage:
    """A channel-agnostic message. Channels use what they support and ignore
    the rest (e.g. Telegram has no subject; it is folded into the body)."""

    recipients: list[str]
    body: str
    subject: str | None = None
    body_format: str = "text"  # text | html | markdown
    attachments: list[Attachment] = field(default_factory=list)


@dataclass
class DeliveryResult:
    ok: bool
    summary: str
    provider_refs: list[str] = field(default_factory=list)


class ChannelError(Exception):
    """A message could not be built or delivered."""


# ---------------------------------------------------------------------------
# Config descriptors (drive validation + the settings UI)
# ---------------------------------------------------------------------------


@dataclass
class ConfigField:
    key: str
    label: str
    secret: bool = False
    required: bool = True
    help: str = ""
    placeholder: str = ""


# ---------------------------------------------------------------------------
# Pluggable HTTP transport (so channels are unit-testable without a network)
# ---------------------------------------------------------------------------


@dataclass
class HttpResponse:
    status_code: int
    text: str
    payload: Any = None

    def json(self) -> Any:
        return self.payload

    @property
    def ok(self) -> bool:
        return 200 <= self.status_code < 300


HttpPost = Callable[..., HttpResponse]


def default_http_post(
    url: str,
    *,
    json: Any = None,
    data: Any = None,
    files: Any = None,
    headers: dict[str, str] | None = None,
    timeout: float = 30.0,
) -> HttpResponse:
    import httpx

    resp = httpx.post(url, json=json, data=data, files=files, headers=headers, timeout=timeout)
    try:
        payload = resp.json()
    except Exception:  # noqa: BLE001 - non-JSON body is fine
        payload = None
    return HttpResponse(resp.status_code, resp.text, payload)


# ---------------------------------------------------------------------------
# Channel base class
# ---------------------------------------------------------------------------


class Channel(ABC):
    """Base class for a messaging channel."""

    type: str = ""
    label: str = ""
    config_fields: list[ConfigField] = []
    # Human hint shown in the UI for the step's `with:` parameters.
    send_hint: str = "to, subject, body, format, attachments"
    supports_attachments: bool = True
    supports_subject: bool = True
    supports_html: bool = False

    @abstractmethod
    def send(self, message: OutboundMessage) -> DeliveryResult:  # pragma: no cover
        ...

    # -- config helpers ------------------------------------------------------
    @classmethod
    def required_keys(cls) -> list[str]:
        return [f.key for f in cls.config_fields if f.required]

    @classmethod
    def secret_keys(cls) -> set[str]:
        return {f.key for f in cls.config_fields if f.secret}

    @classmethod
    def validate_config(cls, config: dict[str, str]) -> None:
        missing = [k for k in cls.required_keys() if not str(config.get(k, "")).strip()]
        if missing:
            raise ChannelError(
                f"{cls.label} is missing required setting(s): {', '.join(missing)}"
            )
