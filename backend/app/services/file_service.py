"""Workspace file manager (Phase 4).

Operates directly on the workspace working tree. All paths run through
``storage.safe_join`` so traversal outside the workspace is impossible.
"""
from __future__ import annotations

import shutil
import uuid
from pathlib import Path

from app.core.exceptions import AppException, ConflictError, NotFoundError
from app.core.storage import ensure_workspace_dir, rel_path, safe_join
from app.schemas.file import DirListing, FileContent, FileNode

MAX_EDIT_BYTES = 1_000_000  # 1 MB cap for in-browser editing


class FileService:
    def __init__(self, workspace_id: uuid.UUID) -> None:
        self.workspace_id = workspace_id
        ensure_workspace_dir(workspace_id)

    def _resolve(self, relative: str) -> Path:
        try:
            return safe_join(self.workspace_id, relative)
        except ValueError as exc:
            raise AppException(str(exc), status_code=400) from exc

    def _node(self, p: Path) -> FileNode:
        is_dir = p.is_dir()
        return FileNode(
            name=p.name,
            path=rel_path(self.workspace_id, p),
            type="dir" if is_dir else "file",
            size=None if is_dir else p.stat().st_size,
        )

    def list_dir(self, relative: str = "") -> DirListing:
        target = self._resolve(relative or ".")
        if not target.exists():
            raise NotFoundError("Path not found")
        if not target.is_dir():
            raise ConflictError("Not a directory")
        entries = sorted(
            (self._node(c) for c in target.iterdir() if c.name != ".git"),
            key=lambda n: (n.type != "dir", n.name.lower()),
        )
        rel = "" if relative in (".", "") else rel_path(self.workspace_id, target)
        return DirListing(path=rel, entries=entries)

    def read_file(self, relative: str) -> FileContent:
        target = self._resolve(relative)
        if not target.exists() or not target.is_file():
            raise NotFoundError("File not found")
        size = target.stat().st_size
        if size > MAX_EDIT_BYTES:
            raise ConflictError(f"File too large to open ({size} bytes)")
        raw = target.read_bytes()
        try:
            content = raw.decode("utf-8")
        except UnicodeDecodeError as exc:
            raise ConflictError("Binary file — cannot display as text") from exc
        return FileContent(path=rel_path(self.workspace_id, target), content=content, size=size)

    def write_file(self, relative: str, content: str) -> FileNode:
        target = self._resolve(relative)
        if target.is_dir():
            raise ConflictError("Path is a directory")
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8")
        return self._node(target)

    def upload_file(self, relative: str, data: bytes) -> FileNode:
        target = self._resolve(relative)
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_bytes(data)
        return self._node(target)

    def make_dir(self, relative: str) -> FileNode:
        target = self._resolve(relative)
        if target.exists():
            raise ConflictError("Path already exists")
        target.mkdir(parents=True)
        return self._node(target)

    def delete(self, relative: str) -> None:
        target = self._resolve(relative)
        if not target.exists():
            raise NotFoundError("Path not found")
        if target.is_dir():
            shutil.rmtree(target)
        else:
            target.unlink()

    def rename(self, src: str, dst: str) -> FileNode:
        src_p = self._resolve(src)
        dst_p = self._resolve(dst)
        if not src_p.exists():
            raise NotFoundError("Source not found")
        if dst_p.exists():
            raise ConflictError("Destination already exists")
        dst_p.parent.mkdir(parents=True, exist_ok=True)
        src_p.rename(dst_p)
        return self._node(dst_p)
