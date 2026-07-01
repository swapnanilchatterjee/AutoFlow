"""Per-workspace Git operations (Phase 5), backed by GitPython.

Each workspace working tree can be initialised as a Git repository. The
service exposes the common porcelain commands the UI needs: status, stage,
commit, log, branches and checkout. Requires the ``git`` binary on PATH.
"""
from __future__ import annotations

import uuid

from git import GitCommandError, InvalidGitRepositoryError, Repo

from app.core.exceptions import AppException, ConflictError
from app.core.storage import ensure_workspace_dir, workspace_dir
from app.schemas.git import (
    BranchInfo,
    CommitInfo,
    GitFileStatus,
    GitStatus,
)

DEFAULT_BRANCH = "main"
_DEF_NAME = "AutoFlow"
_DEF_EMAIL = "autoflow@localhost"


class GitService:
    def __init__(self, workspace_id: uuid.UUID) -> None:
        self.workspace_id = workspace_id
        self.path = ensure_workspace_dir(workspace_id)

    def _repo(self) -> Repo | None:
        try:
            return Repo(workspace_dir(self.workspace_id))
        except InvalidGitRepositoryError:
            return None

    def init(self) -> GitStatus:
        if self._repo() is not None:
            raise ConflictError("Repository already initialised")
        repo = Repo.init(self.path, initial_branch=DEFAULT_BRANCH)
        with repo.config_writer() as cw:
            cw.set_value("user", "name", _DEF_NAME)
            cw.set_value("user", "email", _DEF_EMAIL)
        return self.status()

    def status(self) -> GitStatus:
        repo = self._repo()
        if repo is None:
            return GitStatus(initialized=False, clean=True)

        try:
            branch = repo.active_branch.name
        except (TypeError, ValueError):
            branch = repo.head.commit.hexsha[:7] if repo.head.is_valid() else None

        staged: list[GitFileStatus] = []
        unstaged: list[GitFileStatus] = []
        if repo.head.is_valid():
            for d in repo.index.diff("HEAD"):
                staged.append(GitFileStatus(path=d.a_path or d.b_path, status="staged"))
        else:
            # No commits yet: everything in the index counts as staged.
            for path, _ in repo.index.entries.keys():  # type: ignore[misc]
                staged.append(GitFileStatus(path=path, status="staged"))

        for d in repo.index.diff(None):
            kind = "deleted" if d.deleted_file else "modified"
            unstaged.append(GitFileStatus(path=d.a_path or d.b_path, status=kind))

        untracked = list(repo.untracked_files)
        clean = not staged and not unstaged and not untracked
        return GitStatus(
            initialized=True,
            branch=branch,
            staged=staged,
            unstaged=unstaged,
            untracked=untracked,
            clean=clean,
        )

    def _require_repo(self) -> Repo:
        repo = self._repo()
        if repo is None:
            raise ConflictError("Repository not initialised")
        return repo

    def stage(self, paths: list[str]) -> GitStatus:
        repo = self._require_repo()
        if paths:
            repo.git.add(paths)
        else:
            repo.git.add(all=True)
        return self.status()

    def commit(
        self,
        message: str,
        *,
        add_all: bool = True,
        author_name: str | None = None,
        author_email: str | None = None,
    ) -> CommitInfo:
        repo = self._require_repo()
        if add_all:
            repo.git.add(all=True)
        if not repo.is_dirty(index=True, working_tree=False, untracked_files=False) and (
            repo.head.is_valid() and not repo.index.diff("HEAD")
        ):
            raise ConflictError("Nothing to commit")
        env = {}
        if author_name:
            env["GIT_AUTHOR_NAME"] = env["GIT_COMMITTER_NAME"] = author_name
        if author_email:
            env["GIT_AUTHOR_EMAIL"] = env["GIT_COMMITTER_EMAIL"] = author_email
        try:
            with repo.git.custom_environment(**env):
                repo.git.commit(m=message)
        except GitCommandError as exc:
            raise ConflictError(exc.stderr.strip() or "Commit failed") from exc
        c = repo.head.commit
        return CommitInfo(
            sha=c.hexsha,
            short_sha=c.hexsha[:7],
            message=c.message.strip(),
            author=f"{c.author.name} <{c.author.email}>",
            date=c.committed_datetime.isoformat(),
        )

    def log(self, limit: int = 50) -> list[CommitInfo]:
        repo = self._repo()
        if repo is None or not repo.head.is_valid():
            return []
        out: list[CommitInfo] = []
        for c in repo.iter_commits(max_count=limit):
            out.append(
                CommitInfo(
                    sha=c.hexsha,
                    short_sha=c.hexsha[:7],
                    message=c.message.strip(),
                    author=f"{c.author.name} <{c.author.email}>",
                    date=c.committed_datetime.isoformat(),
                )
            )
        return out

    def branches(self) -> list[BranchInfo]:
        repo = self._repo()
        if repo is None:
            return []
        current = None
        try:
            current = repo.active_branch.name
        except (TypeError, ValueError):
            pass
        return [BranchInfo(name=h.name, is_current=h.name == current) for h in repo.heads]

    def create_branch(self, name: str, checkout: bool = True) -> list[BranchInfo]:
        repo = self._require_repo()
        if not repo.head.is_valid():
            raise ConflictError("Create a commit before branching")
        if name in [h.name for h in repo.heads]:
            raise ConflictError("Branch already exists")
        new = repo.create_head(name)
        if checkout:
            new.checkout()
        return self.branches()

    def checkout(self, name: str) -> GitStatus:
        repo = self._require_repo()
        try:
            repo.git.checkout(name)
        except GitCommandError as exc:
            raise AppException(exc.stderr.strip() or "Checkout failed", status_code=400) from exc
        return self.status()

    def diff(self, staged: bool = False) -> str:
        repo = self._repo()
        if repo is None:
            return ""
        return repo.git.diff("--cached") if staged else repo.git.diff()
