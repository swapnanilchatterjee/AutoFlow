"""Workflow definition parser & validator (Phases 7 + integrations).

Workflow definitions are YAML, modelled loosely on GitHub Actions. A step is
either a shell step (``run:``) or an action step (``uses:``) that delivers a
message through a configured channel:

    name: Nightly report
    env:
      REPORT: reports/daily.pdf
    steps:
      - name: Build report
        run: ./make_report.sh

      - name: Email it
        uses: gmail                 # gmail | telegram | whatsapp
        with:
          to: [alice@x.com, bob@x.com]
          subject: Daily report
          body: "Attached is today's report."
          format: text              # text | html | markdown
          attachments: [reports/daily.pdf]

Each step must have exactly one of ``run`` or ``uses``. On any structural
problem the parser raises :class:`WorkflowParseError`.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import yaml

from app.integrations.registry import channel_types


class WorkflowParseError(ValueError):
    """Raised when a workflow definition is structurally invalid."""


@dataclass
class ParsedStep:
    name: str
    run: str | None = None
    uses: str | None = None
    with_: dict = field(default_factory=dict)
    env: dict[str, str] = field(default_factory=dict)
    continue_on_error: bool = False

    @property
    def is_action(self) -> bool:
        return self.uses is not None

    @property
    def command_display(self) -> str:
        """A short string stored on the StepRun row for display."""
        if self.uses:
            to = self.with_.get("to")
            target = ", ".join(to) if isinstance(to, list) else (to or "")
            return f"uses: {self.uses}" + (f" → {target}" if target else "")
        return self.run or ""


@dataclass
class ParsedWorkflow:
    name: str
    env: dict[str, str] = field(default_factory=dict)
    steps: list[ParsedStep] = field(default_factory=list)


def _as_env(value: object, where: str) -> dict[str, str]:
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise WorkflowParseError(f"'{where}' must be a mapping of KEY: value")
    return {str(k): "" if v is None else str(v) for k, v in value.items()}


def _parse_step(raw: dict, i: int) -> ParsedStep:
    run = raw.get("run")
    uses = raw.get("uses")

    has_run = isinstance(run, str) and run.strip()
    has_uses = isinstance(uses, str) and uses.strip()

    if has_run and has_uses:
        raise WorkflowParseError(f"Step {i} cannot have both 'run' and 'uses'")
    if not has_run and not has_uses:
        raise WorkflowParseError(f"Step {i} must have a 'run' command or a 'uses' action")

    name = str(raw.get("name") or f"Step {i}")
    common = {
        "name": name,
        "env": _as_env(raw.get("env"), f"steps[{i}].env"),
        "continue_on_error": bool(raw.get("continue_on_error", False)),
    }

    if has_uses:
        channel = uses.strip()
        if channel not in channel_types():
            allowed = ", ".join(channel_types())
            raise WorkflowParseError(
                f"Step {i} uses unknown action '{channel}' (available: {allowed})"
            )
        with_ = raw.get("with") or {}
        if not isinstance(with_, dict):
            raise WorkflowParseError(f"Step {i} 'with' must be a mapping")
        if not with_.get("to"):
            raise WorkflowParseError(f"Step {i} ('{channel}') needs a 'to' recipient")
        return ParsedStep(uses=channel, with_=with_, **common)

    return ParsedStep(run=run, **common)


def parse_workflow(definition: str, *, default_name: str = "workflow") -> ParsedWorkflow:
    if not definition or not definition.strip():
        raise WorkflowParseError("Workflow definition is empty")

    try:
        data = yaml.safe_load(definition)
    except yaml.YAMLError as exc:
        raise WorkflowParseError(f"Invalid YAML: {exc}") from exc

    if not isinstance(data, dict):
        raise WorkflowParseError("Top level must be a mapping")

    raw_steps = data.get("steps")
    if not isinstance(raw_steps, list) or not raw_steps:
        raise WorkflowParseError("'steps' must be a non-empty list")

    steps: list[ParsedStep] = []
    for i, raw in enumerate(raw_steps, start=1):
        if not isinstance(raw, dict):
            raise WorkflowParseError(f"Step {i} must be a mapping")
        steps.append(_parse_step(raw, i))

    return ParsedWorkflow(
        name=str(data.get("name") or default_name),
        env=_as_env(data.get("env"), "env"),
        steps=steps,
    )


def validate_definition(definition: str) -> None:
    """Validate without returning the parsed object (raises on error)."""
    parse_workflow(definition)
