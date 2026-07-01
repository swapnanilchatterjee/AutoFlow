import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import type { DashboardStats } from "../lib/types";
import { Card, EmptyState, Spinner, StatusPill, fmtDate } from "../components/ui";

function Kpi({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <Card className="p-5">
      <p className="text-xs uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-2 text-3xl font-semibold ${accent ? "text-emerald-400" : "text-zinc-100"}`}>{value}</p>
    </Card>
  );
}

export default function Dashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard.stats().then(setStats).catch((e) => setError(e.message));
  }, []);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!stats) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;

  const byStatus = Object.fromEntries(stats.runs_by_status.map((s) => [s.status, s.count]));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="mt-1 text-sm text-zinc-500">Activity across all your workspaces.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi label="Workspaces" value={stats.workspaces} />
        <Kpi label="Workflows" value={stats.workflows} />
        <Kpi label="Total runs" value={stats.total_runs} />
        <Kpi label="Success rate" value={`${stats.success_rate}%`} accent />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-1">
          <h2 className="mb-4 text-sm font-semibold text-zinc-200">Runs by status</h2>
          <div className="space-y-2.5">
            {["success", "failed", "running", "queued", "cancelled"].map((s) => (
              <div key={s} className="flex items-center justify-between text-sm">
                <StatusPill status={s} />
                <span className="font-mono text-zinc-300">{byStatus[s] ?? 0}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5 lg:col-span-2">
          <h2 className="mb-4 text-sm font-semibold text-zinc-200">Recent runs</h2>
          {stats.recent_runs.length === 0 ? (
            <EmptyState title="No runs yet" hint="Trigger a workflow to see runs appear here." />
          ) : (
            <div className="divide-y divide-zinc-800">
              {stats.recent_runs.map((r) => (
                <Link
                  key={r.id}
                  to={`/workspaces/${r.workspace_id}/workflows/${r.workflow_id}/runs/${r.id}`}
                  className="flex items-center justify-between py-2.5 text-sm hover:opacity-80"
                >
                  <div className="min-w-0">
                    <span className="font-medium text-zinc-200">{r.workflow_name}</span>
                    <span className="ml-2 text-zinc-500">#{r.run_number}</span>
                    <span className="ml-2 text-xs text-zinc-600">{r.workspace_slug}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-500">{fmtDate(r.created_at)}</span>
                    <StatusPill status={r.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
