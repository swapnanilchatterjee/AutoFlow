"""Filesystem helpers for per-workspace working trees (Phases 4, 5, 9).

Every workspace gets a directory at ``WORKSPACES_ROOT/<workspace_id>``. All
user-supplied paths are resolved through :func:`safe_join`, which guarantees
the result stays inside the workspace root (defeats ``../`` traversal).
"""
from __future__ import annotations

import uuid
from pathlib import Path

from app.core.config import settings


def workspace_dir(workspace_id: uuid.UUID) -> Path:
    root = Path(settings.WORKSPACES_ROOT) / str(workspace_id)
    return root


def ensure_workspace_dir(workspace_id: uuid.UUID) -> Path:
    d = workspace_dir(workspace_id)
    d.mkdir(parents=True, exist_ok=True)
    return d


def safe_join(workspace_id: uuid.UUID, relative: str) -> Path:
    """Resolve ``relative`` under the workspace root, blocking traversal."""
    base = workspace_dir(workspace_id).resolve()
    base.mkdir(parents=True, exist_ok=True)
    candidate = (base / relative.lstrip("/")).resolve()
    if candidate != base and base not in candidate.parents:
        raise ValueError("Path escapes workspace root")
    return candidate


def rel_path(workspace_id: uuid.UUID, absolute: Path) -> str:
    base = workspace_dir(workspace_id).resolve()
    return str(absolute.resolve().relative_to(base))
