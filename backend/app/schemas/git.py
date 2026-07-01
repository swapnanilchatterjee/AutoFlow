"""Git schemas (Phase 5)."""
from pydantic import BaseModel, Field


class GitFileStatus(BaseModel):
    path: str
    status: str  # e.g. "modified", "untracked", "staged", "deleted"


class GitStatus(BaseModel):
    initialized: bool
    branch: str | None = None
    staged: list[GitFileStatus] = []
    unstaged: list[GitFileStatus] = []
    untracked: list[str] = []
    clean: bool = True


class CommitInfo(BaseModel):
    sha: str
    short_sha: str
    message: str
    author: str
    date: str


class CommitRequest(BaseModel):
    message: str = Field(min_length=1)
    add_all: bool = True
    author_name: str | None = None
    author_email: str | None = None


class StageRequest(BaseModel):
    paths: list[str] = []  # empty = stage all


class BranchInfo(BaseModel):
    name: str
    is_current: bool


class CreateBranchRequest(BaseModel):
    name: str = Field(min_length=1)
    checkout: bool = True
