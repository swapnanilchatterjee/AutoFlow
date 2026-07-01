import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Check, ChevronDown, ChevronLeft, Loader2, Minus, X } from "lucide-react";
import { api } from "../lib/api";
import type { StepRun, WorkflowRun } from "../lib/types";
import { Badge, Button, ErrorText, Skeleton, StatusPill, cn, fmtDate } from "../components/ui";

const ACTIVE = new Set(["queued", "running"]);

function fmtDuration(start: string | null, end: string | null): string | null {
  if (!start) return null;
  const a = new Date(start).getTime();
  const b = end ? new Date(end).getTime() : Date.now();
  const ms = Math.max(0, b - a);
  if (ms < 1000) return `${ms}ms`;
  const s = ms / 1000;
  if (s < 60) return `${s.toFixed(1)}s`;
  const m = Math.floor(s / 60);
  const rem = Math.round(s % 60);
  return `${m}m ${rem}s`;
}

export default function RunDetail() {
  const { wsId = "", wfId = "", runId = "" } = useParams();
  const [run, setRun] = useState<WorkflowRun | null>(null);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fetchRun = useCallback(async () => {
    try {
      const r = await api.workflows.run(wsId, wfId, runId);
      setRun(r);
      if (ACTIVE.has(r.status)) { timer.current = setTimeout(fetchRun, 2000); }
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }, [wsId, wfId, runId]);

  useEffect(() => {
    fetchRun();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [fetchRun]);

  async function cancel() {
    try { setRun(await api.workflows.cancel(wsId, wfId, runId)); } catch { /* ignore */ }
  }

  if (error && !run) return <p className="text-danger">{error}</p>;
  if (!run) return (
    <div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-48" />
      <Skeleton className="mt-6 h-40 w-full" />
    </div>
  );

  const isActive = ACTIVE.has(run.status);
  const steps = run.steps ?? [];
  const duration = fmtDuration(run.started_at, run.finished_at);

  return (
    <div>
      <Link to={`/workspaces/${wsId}/workflows/${wfId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Workflow
      </Link>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-[22px] font-semibold tracking-[-0.01em] text-ink tnum">Run #{run.run_number}</h1>
            <StatusPill status={run.status} />
            <Badge tone="neutral" className="capitalize">{run.trigger}</Badge>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted">
            <span>Started {fmtDate(run.started_at)}</span>
            {run.finished_at && <span>Finished {fmtDate(run.finished_at)}</span>}
            {duration && <span>Duration <span className="font-medium text-ink tnum">{duration}</span></span>}
            <span>{steps.length} step{steps.length === 1 ? "" : "s"}</span>
          </div>
        </div>
        {isActive && <Button variant="danger" onClick={cancel}>Cancel run</Button>}
      </div>

      {run.error && <div className="mb-4"><ErrorText>{run.error}</ErrorText></div>}

      {/* Pipeline */}
      <div className="rounded-xl border border-slate-100 bg-white p-4 shadow-premium sm:p-6">
        {steps.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Waiting for steps to start…</p>
        ) : (
          steps.map((s, i) => <StepNode key={s.id} step={s} last={i === steps.length - 1} />)
        )}
      </div>
    </div>
  );
}

const NODE: Record<string, { ring: string; icon: React.ReactNode }> = {
  success: { ring: "bg-ok text-white", icon: <Check className="h-4 w-4" /> },
  failed: { ring: "bg-danger text-white", icon: <X className="h-4 w-4" /> },
  running: { ring: "bg-info text-white", icon: <Loader2 className="h-4 w-4 animate-spin" /> },
  queued: { ring: "border-2 border-line bg-surface text-faint", icon: <span className="h-1.5 w-1.5 rounded-full bg-faint" /> },
  pending: { ring: "border-2 border-line bg-surface text-faint", icon: <span className="h-1.5 w-1.5 rounded-full bg-faint" /> },
  skipped: { ring: "bg-hairline text-faint", icon: <Minus className="h-4 w-4" /> },
  cancelled: { ring: "bg-hairline text-faint", icon: <Minus className="h-4 w-4" /> },
};

function StepNode({ step, last }: { step: StepRun; last: boolean }) {
  const [open, setOpen] = useState(step.status === "running" || step.status === "failed");
  const node = NODE[step.status] ?? NODE.pending;
  const dur = fmtDuration(step.started_at, step.finished_at);
  const failed = step.exit_code !== null && step.exit_code !== 0;

  return (
    <div className="flex gap-3.5 sm:gap-4">
      {/* Rail */}
      <div className="flex flex-col items-center">
        <span className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full",
          node.ring,
          step.status === "running" && "ring-4 ring-info-50",
        )}>
          {node.icon}
        </span>
        {!last && <span className="my-1 w-px flex-1 bg-line" />}
      </div>

      {/* Step card */}
      <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
        <div className="overflow-hidden rounded-xl border border-line bg-surface">
          <button
            onClick={() => setOpen((o) => !o)}
            className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-canvas/60"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-ink">{step.name}</span>
                {failed && <span className="font-mono text-xs text-danger">exit {step.exit_code}</span>}
              </div>
              {step.command && <p className="mt-0.5 truncate font-mono text-xs text-faint">{step.command}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {dur && <span className="text-xs text-faint tnum">{dur}</span>}
              <StatusPill status={step.status} />
              <ChevronDown className={cn("h-4 w-4 text-faint transition-transform", open && "rotate-180")} />
            </div>
          </button>

          {open && (
            <div className="border-t border-line">
              <pre className="scroll-slim max-h-96 overflow-auto bg-[#0E1117] px-4 py-3 font-mono text-xs leading-relaxed text-[#D6DAE1]">
                {step.logs?.trim()
                  ? step.logs
                  : <span className="text-[#6B7280]">{step.status === "skipped" ? "Skipped." : "No output yet."}</span>}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
