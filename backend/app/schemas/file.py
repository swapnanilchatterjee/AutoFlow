"""File-manager schemas (Phase 4)."""
from pydantic import BaseModel, Field


class FileNode(BaseModel):
    name: str
    path: str            # relative to workspace root
    type: str            # "file" | "dir"
    size: int | None = None


class DirListing(BaseModel):
    path: str
    entries: list[FileNode]


class FileContent(BaseModel):
    path: str
    content: str
    size: int
    encoding: str = "utf-8"


class WriteFileRequest(BaseModel):
    content: str


class CreateDirRequest(BaseModel):
    path: str = Field(min_length=1)


class RenameRequest(BaseModel):
    src: str
    dst: str
