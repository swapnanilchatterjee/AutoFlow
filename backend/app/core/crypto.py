"""Symmetric encryption for stored secrets (Phase 6).

Secret values are encrypted at rest with Fernet (AES-128-CBC + HMAC). The
Fernet key is derived deterministically from ``SECRET_KEY`` so no extra key
material needs to be managed; rotating ``SECRET_KEY`` invalidates stored
secrets (documented behaviour).
"""
from __future__ import annotations

import base64
import hashlib

from cryptography.fernet import Fernet, InvalidToken

from app.core.config import settings


def _fernet() -> Fernet:
    digest = hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest()
    key = base64.urlsafe_b64encode(digest)
    return Fernet(key)


def encrypt(plaintext: str) -> str:
    return _fernet().encrypt(plaintext.encode("utf-8")).decode("utf-8")


def decrypt(token: str) -> str:
    try:
        return _fernet().decrypt(token.encode("utf-8")).decode("utf-8")
    except InvalidToken as exc:  # pragma: no cover - defensive
        raise ValueError("Could not decrypt secret (SECRET_KEY changed?)") from exc
