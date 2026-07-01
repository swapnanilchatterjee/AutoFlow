import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { StepRun, WorkflowRun } from "../lib/types";
import { Badge, Button, Card, Spinner, StatusPill, cn, fmtDate } from "../components/ui";

const ACTIVE = new Set(["queued", "running"]);

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

  if (error && !run) return <p className="text-red-400">{error}</p>;
  if (!run) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;

  const isActive = ACTIVE.has(run.status);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to={`/workspaces/${wsId}/workflows/${wfId}`} className="text-sm text-zinc-500 hover:text-zinc-300">← Workflow</Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">Run #{run.run_number}</h1>
            <StatusPill status={run.status} />
            <Badge>{run.trigger}</Badge>
          </div>
          <p className="mt-1 text-sm text-zinc-500">
            Started {fmtDate(run.started_at)} {run.finished_at && <>· finished {fmtDate(run.finished_at)}</>}
          </p>
        </div>
        {isActive && <Button variant="danger" onClick={cancel}>Cancel run</Button>}
      </div>

      {run.error && (
        <Card className="border-red-500/30 p-4">
          <p className="text-sm text-red-400">{run.error}</p>
        </Card>
      )}

      <div className="space-y-3">
        {(run.steps ?? []).map((s) => <StepCard key={s.id} step={s} />)}
      </div>
    </div>
  );
}

function StepCard({ step }: { step: StepRun }) {
  const [open, setOpen] = useState(step.status === "running" || step.status === "failed");
  return (
    <Card className="overflow-hidden">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-3 text-left hover:bg-zinc-800/40"
      >
        <div className="flex items-center gap-3">
          <span className="text-zinc-600">{open ? "▾" : "▸"}</span>
          <span className="text-sm font-medium text-zinc-200">{step.name}</span>
          {step.exit_code !== null && step.exit_code !== 0 && (
            <span className="font-mono text-xs text-red-400">exit {step.exit_code}</span>
          )}
        </div>
        <StatusPill status={step.status} />
      </button>
      {open && (
        <div className="border-t border-zinc-800 bg-zinc-950">
          <pre className={cn(
            "max-h-96 overflow-auto px-4 py-3 font-mono text-xs leading-relaxed",
            step.status === "failed" ? "text-zinc-300" : "text-zinc-400",
          )}>
            {step.logs?.trim() ? step.logs : <span className="text-zinc-600">{step.status === "skipped" ? "Skipped." : "No output."}</span>}
          </pre>
        </div>
      )}
    </Card>
  );
}
