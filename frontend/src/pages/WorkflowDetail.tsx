import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { TriggerType, Workflow, WorkflowRun } from "../lib/types";
import { Badge, Button, Card, EmptyState, ErrorText, Input, Label, Spinner, StatusPill, Textarea, fmtDate } from "../components/ui";

export default function WorkflowDetail() {
  const { wsId = "", wfId = "" } = useParams();
  const navigate = useNavigate();
  const [wf, setWf] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [definition, setDefinition] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [triggering, setTriggering] = useState(false);

  const loadRuns = useCallback(() => { api.workflows.runs(wsId, wfId).then(setRuns).catch(() => {}); }, [wsId, wfId]);
  const load = useCallback(() => {
    api.workflows.get(wsId, wfId).then((w) => { setWf(w); setDefinition(w.definition); setDirty(false); }).catch((e) => setError(e.message));
    loadRuns();
  }, [wsId, wfId, loadRuns]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setError(null); setSaved(false);
    try { const w = await api.workflows.update(wsId, wfId, { definition }); setWf(w); setDirty(false); setSaved(true); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
  }

  async function patch(body: Partial<Workflow>) {
    try { setWf(await api.workflows.update(wsId, wfId, body)); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  }

  async function toggleEnabled() {
    if (!wf) return;
    const newValue = !wf.enabled;
    // optimistic update
    setWf(prev => prev ? { ...prev, enabled: newValue } : null);
    try {
      await api.workflows.update(wsId, wfId, { enabled: newValue });
    } catch (e) {
      // revert on failure
      setWf(prev => prev ? { ...prev, enabled: !newValue } : null);
      setError(e instanceof Error ? e.message : "Toggle failed");
    }
  }

  async function regen() { try { setWf(await api.workflows.regenerateWebhook(wsId, wfId)); } catch { /* ignore */ } }

  async function run() {
    setTriggering(true); setError(null);
    try { const r = await api.workflows.trigger(wsId, wfId); navigate(`/workspaces/${wsId}/workflows/${wfId}/runs/${r.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Trigger failed"); setTriggering(false); }
  }

  if (error && !wf) return <p className="text-red-400">{error}</p>;
  if (!wf) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;

  const webhookUrl = wf.webhook_token ? `${location.origin}/api/v1/webhooks/${wf.webhook_token}` : null;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <Link to={`/workspaces/${wsId}`} className="text-sm text-zinc-500 hover:text-zinc-300">← {wf.workspace_id ? "Workspace" : ""}</Link>
          <div className="mt-2 flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{wf.name}</h1>
            <Badge>{wf.trigger_type}</Badge>
            {!wf.enabled && <StatusPill status="cancelled" />}
          </div>
        </div>
        <Button onClick={run} disabled={triggering}>{triggering ? "Starting…" : "Run now"}</Button>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <Card className="p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-zinc-200">Definition (YAML)</h2>
              <div className="flex items-center gap-3">
                {saved && <span className="text-sm text-emerald-400">Saved</span>}
                {dirty && <span className="text-sm text-amber-400">Unsaved</span>}
                <Button onClick={save} disabled={!dirty}>Save</Button>
              </div>
            </div>
            <Textarea
              value={definition}
              onChange={(e) => { setDefinition(e.target.value); setDirty(true); setSaved(false); }}
              className="min-h-[360px] font-mono text-xs leading-relaxed"
              spellCheck={false}
            />
            <ErrorText>{error}</ErrorText>
          </Card>
        </div>

        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="mb-3 text-sm font-semibold text-zinc-200">Trigger</h2>
            <div className="space-y-3">
              <div>
                <Label>Type</Label>
                <div className="flex gap-1.5">
                  {(["manual", "schedule", "webhook"] as TriggerType[]).map((t) => (
                    <button key={t} onClick={() => patch({ trigger_type: t })}
                      className={`flex-1 rounded-md border px-2 py-1.5 text-xs capitalize ${wf.trigger_type === t ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              {wf.trigger_type === "schedule" && (
                <>
                  <div>
                    <Label>Cron schedule</Label>
                    <Input
                      defaultValue={wf.schedule_cron ?? "0 * * * *"}
                      onBlur={(e) => patch({ schedule_cron: e.target.value })}
                      className="font-mono text-xs"
                    />
                    <p className="mt-1 text-xs text-zinc-600">Evaluated every minute by the scheduler.</p>
                  </div>
                  <div>
                    <Label>Timezone</Label>
                    <select
                      value={wf.schedule_tz ?? "UTC"}
                      onChange={(e) => patch({ schedule_tz: e.target.value })}
                      className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                    >
                      <option value="UTC">UTC</option>
                      <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>{Intl.DateTimeFormat().resolvedOptions().timeZone} (Local)</option>
                      <option value="America/New_York">America/New_York (EST/EDT)</option>
                      <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                      <option value="America/Denver">America/Denver (MST/MDT)</option>
                      <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                      <option value="Europe/London">Europe/London (GMT/BST)</option>
                      <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                      <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                      <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                      <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                    </select>
                  </div>
                  {wf.next_runs && wf.next_runs.length > 0 && (
                    <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-3">
                      <Label>Next execution times ({wf.schedule_tz || "UTC"})</Label>
                      <ul className="mt-1.5 space-y-1 font-mono text-[10px] text-zinc-400">
                        {wf.next_runs.map((r, i) => (
                          <li key={i} className="flex items-center gap-1.5">
                            <span className="text-emerald-500">→</span>
                            {new Date(r).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: false,
                              timeZone: wf.schedule_tz || "UTC"
                            })}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </>
              )}
              {wf.trigger_type === "webhook" && webhookUrl && (
                <div>
                  <Label>Webhook URL</Label>
                  <div className="rounded-lg border border-zinc-700 bg-zinc-950 p-2">
                    <code className="block break-all text-xs text-emerald-400">{webhookUrl}</code>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button variant="ghost" onClick={regen}>Regenerate</Button>
                  </div>
                </div>
              )}
              <div className="flex items-center justify-between border-t border-zinc-800 pt-3">
                <span className="text-sm text-zinc-300">Enabled</span>
                <button
                  type="button"
                  onClick={toggleEnabled}
                  className={`relative h-6 w-11 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 focus:ring-offset-zinc-900 ${wf.enabled ? "bg-emerald-500" : "bg-zinc-700"}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${wf.enabled ? "translate-x-5" : "translate-x-0.5"}`} />
                </button>
              </div>
            </div>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <h2 className="mb-4 text-sm font-semibold text-zinc-200">Runs</h2>
        {runs.length === 0 ? (
          <EmptyState title="No runs yet" hint="Trigger this workflow to see run history and logs." />
        ) : (
          <div className="divide-y divide-zinc-800">
            {runs.map((r) => (
              <Link
                key={r.id}
                to={`/workspaces/${wsId}/workflows/${wfId}/runs/${r.id}`}
                className="flex items-center justify-between py-2.5 text-sm hover:opacity-80"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-zinc-300">#{r.run_number}</span>
                  <Badge>{r.trigger}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-zinc-500">{fmtDate(r.started_at ?? r.created_at)}</span>
                  <StatusPill status={r.status} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}
