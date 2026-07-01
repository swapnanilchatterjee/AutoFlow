"""Workflow definition parser & validator (Phase 7).

Workflow definitions are YAML, modelled loosely on GitHub Actions:

    name: Build and Test          # optional (defaults to the workflow name)
    env:                          # optional workflow-level environment
      GREETING: hello
    steps:
      - name: Greet
        run: echo "$GREETING"
      - name: Build
        run: |
          make build
          make test
        env:                      # optional, overrides workflow env
          MODE: release
        continue_on_error: false  # optional (default false)

The parser returns a structured, validated object; on any structural problem
it raises :class:`WorkflowParseError` with a human-readable message.
"""
from __future__ import annotations

from dataclasses import dataclass, field

import yaml


class WorkflowParseError(ValueError):
    """Raised when a workflow definition is structurally invalid."""


@dataclass
class ParsedStep:
    name: str
    run: str
    env: dict[str, str] = field(default_factory=dict)
    continue_on_error: bool = False


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
        run = raw.get("run")
        if not isinstance(run, str) or not run.strip():
            raise WorkflowParseError(f"Step {i} must have a non-empty 'run' command")
        name = str(raw.get("name") or f"Step {i}")
        steps.append(
            ParsedStep(
                name=name,
                run=run,
                env=_as_env(raw.get("env"), f"steps[{i}].env"),
                continue_on_error=bool(raw.get("continue_on_error", False)),
            )
        )

    return ParsedWorkflow(
        name=str(data.get("name") or default_name),
        env=_as_env(data.get("env"), "env"),
        steps=steps,
    )


def validate_definition(definition: str) -> None:
    """Validate without returning the parsed object (raises on error)."""
    parse_workflow(definition)
