import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronLeft, Copy, Play, RefreshCw, Send } from "lucide-react";
import { api } from "../lib/api";
import type { TriggerType, Workflow, WorkflowRun } from "../lib/types";
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorText, Field, Input, Label,
  PageHeader, Select, Skeleton, StatusPill, Textarea, cn, fmtRelative, useToast,
} from "../components/ui";

const TRIGGERS: TriggerType[] = ["manual", "schedule", "webhook"];

export default function WorkflowDetail() {
  const { wsId = "", wfId = "" } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [wf, setWf] = useState<Workflow | null>(null);
  const [runs, setRuns] = useState<WorkflowRun[]>([]);
  const [definition, setDefinition] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);

  const loadRuns = useCallback(() => { api.workflows.runs(wsId, wfId).then(setRuns).catch(() => {}); }, [wsId, wfId]);
  const load = useCallback(() => {
    api.workflows.get(wsId, wfId).then((w) => { setWf(w); setDefinition(w.definition); setDirty(false); }).catch((e) => setError(e.message));
    loadRuns();
  }, [wsId, wfId, loadRuns]);
  useEffect(() => { load(); }, [load]);

  async function save() {
    setError(null); setSaving(true);
    try { const w = await api.workflows.update(wsId, wfId, { definition }); setWf(w); setDirty(false); toast.success("Definition saved"); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
    finally { setSaving(false); }
  }
  async function patch(body: Partial<Workflow>) {
    try { setWf(await api.workflows.update(wsId, wfId, body)); }
    catch (e) { setError(e instanceof Error ? e.message : "Update failed"); }
  }
  async function regen() {
    try { setWf(await api.workflows.regenerateWebhook(wsId, wfId)); toast.success("Webhook URL regenerated"); } catch { /* ignore */ }
  }
  async function run() {
    setTriggering(true); setError(null);
    try { const r = await api.workflows.trigger(wsId, wfId); navigate(`/workspaces/${wsId}/workflows/${wfId}/runs/${r.id}`); }
    catch (e) { setError(e instanceof Error ? e.message : "Trigger failed"); setTriggering(false); }
  }
  function copyWebhook(url: string) { navigator.clipboard?.writeText(url); toast.success("Webhook URL copied"); }

  if (error && !wf) return <p className="text-danger">{error}</p>;
  if (!wf) return (
    <div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-64" />
      <Skeleton className="mt-6 h-72 w-full" />
    </div>
  );

  const webhookUrl = wf.webhook_token ? `${location.origin}/api/v1/webhooks/${wf.webhook_token}` : null;

  return (
    <div>
      <Link to={`/workspaces/${wsId}`} className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Workspace
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {wf.name}
            <Badge tone="neutral" className="capitalize">{wf.trigger_type}</Badge>
            {!wf.enabled && <StatusPill status="cancelled" />}
          </span>
        }
        actions={<Button onClick={run} disabled={triggering}><Play className="h-4 w-4" /> {triggering ? "Starting…" : "Run now"}</Button>}
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader
              title="Definition"
              description="YAML steps — shell (run:) or delivery actions (uses:)."
              action={
                <div className="flex items-center gap-3">
                  {dirty && <Badge tone="warn">Unsaved</Badge>}
                  <Button size="sm" onClick={save} disabled={!dirty || saving}>{saving ? "Saving…" : "Save"}</Button>
                </div>
              }
            />
            <CardBody>
              <Textarea
                value={definition}
                onChange={(e) => { setDefinition(e.target.value); setDirty(true); }}
                className="min-h-[380px] font-mono text-[13px] leading-relaxed"
                spellCheck={false}
              />
              <p className="mt-2 flex items-center gap-1.5 text-xs text-faint">
                <Send className="h-3.5 w-3.5" />
                Tip: deliver reports with a <code className="rounded bg-hairline px-1 font-mono text-ink">uses:</code> step — set up channels in the Integrations tab.
              </p>
              <ErrorText>{error}</ErrorText>
            </CardBody>
          </Card>
        </div>

        <div>
          <Card>
            <CardHeader title="Trigger" />
            <CardBody className="space-y-4">
              <Field label="Type">
                <div className="grid grid-cols-3 gap-1.5">
                  {TRIGGERS.map((t) => (
                    <button
                      key={t} onClick={() => patch({ trigger_type: t })}
                      className={cn(
                        "rounded-lg border px-2 py-1.5 text-xs font-semibold capitalize transition-all duration-200",
                        wf.trigger_type === t
                          ? "border-brand-200 bg-brand-50/80 text-brand-600 shadow-sm shadow-brand/5"
                          : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </Field>

              {wf.trigger_type === "schedule" && (() => {
                const isPreset = ["*/1 * * * *", "0 * * * *", "0 0 * * *", "0 0 * * 0", "0 0 1 * *"].includes(wf.schedule_cron ?? "");
                const showCustom = showCustomInput || !isPreset;
                return (
                  <>
                    <Field label="Schedule frequency">
                      <Select
                        value={isPreset ? (wf.schedule_cron ?? "0 * * * *") : "custom"}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "custom") {
                            setShowCustomInput(true);
                          } else {
                            setShowCustomInput(false);
                            patch({ schedule_cron: val });
                          }
                        }}
                      >
                        <option value="*/1 * * * *">Every minute</option>
                        <option value="0 * * * *">Every hour</option>
                        <option value="0 0 * * *">Every day (at midnight)</option>
                        <option value="0 0 * * 0">Every week (Sunday at midnight)</option>
                        <option value="0 0 1 * *">Every month (1st day at midnight)</option>
                        <option value="custom">Custom expression...</option>
                      </Select>
                    </Field>

                    {showCustom && (
                      <Field label="Cron expression" help="Standard 5-field cron format: Min Hour Day Month Day-of-Week.">
                        <Input
                          defaultValue={wf.schedule_cron ?? "0 * * * *"}
                          onBlur={(e) => patch({ schedule_cron: e.target.value })}
                          className="font-mono text-[13px]"
                          placeholder="e.g. 0 9 * * 1-5"
                        />
                      </Field>
                    )}

                    <Field label="Timezone" help="Evaluates the schedule in the selected timezone.">
                      <Select
                        value={wf.schedule_tz ?? "UTC"}
                        onChange={(e) => patch({ schedule_tz: e.target.value })}
                      >
                        <option value="UTC">UTC (GMT+00:00)</option>
                        <option value="Asia/Kolkata">Asia/Kolkata (IST, GMT+05:30)</option>
                        <option value="America/New_York">America/New_York (EST/EDT)</option>
                        <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                        <option value="America/Denver">America/Denver (MST/MDT)</option>
                        <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                        <option value="Europe/London">Europe/London (BST/GMT)</option>
                        <option value="Europe/Paris">Europe/Paris (CEST/CET)</option>
                        <option value="Asia/Singapore">Asia/Singapore (SGT, GMT+08:00)</option>
                        <option value="Asia/Tokyo">Asia/Tokyo (JST, GMT+09:00)</option>
                        <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                      </Select>
                    </Field>

                    {wf.next_runs && wf.next_runs.length > 0 && (
                      <div className="mt-4 rounded-xl bg-slate-50 p-4 border border-slate-100">
                        <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">Next 5 scheduled runs</p>
                        <div className="space-y-1.5 font-mono text-[11px] text-slate-600">
                          {wf.next_runs.map((r: string, idx: number) => (
                            <div key={idx} className="flex items-center gap-2">
                              <span className="w-4 text-slate-300 font-bold">{idx + 1}.</span>
                              <span>{new Date(r).toLocaleString()}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}

              {wf.trigger_type === "webhook" && webhookUrl && (
                <div>
                  <Label>Webhook URL</Label>
                  <div className="flex items-center gap-1.5">
                    <code className="min-w-0 flex-1 truncate rounded-lg border border-line bg-canvas px-2.5 py-2 font-mono text-xs text-ink">{webhookUrl}</code>
                    <Button size="sm" variant="secondary" onClick={() => copyWebhook(webhookUrl)}><Copy className="h-3.5 w-3.5" /></Button>
                  </div>
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" variant="ghost" onClick={regen}><RefreshCw className="h-3.5 w-3.5" /> Regenerate</Button>
                  </div>
                </div>
              )}

              <div className="flex items-center justify-between border-t border-hairline pt-4">
                <div>
                  <p className="text-sm font-medium text-ink">Enabled</p>
                  <p className="text-xs text-faint">Turn off to pause scheduled &amp; webhook runs.</p>
                </div>
                <Toggle on={wf.enabled} onClick={() => patch({ enabled: !wf.enabled })} />
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <Card className="mt-6">
        <CardHeader title="Run history" description="Recent executions of this workflow." />
        {runs.length === 0 ? (
          <div className="p-5">
            <EmptyState icon={<Play className="h-5 w-5" />} title="No runs yet" description="Trigger this workflow to see run history and logs." />
          </div>
        ) : (
          <div className="divide-y divide-hairline">
            {runs.map((r) => (
              <Link
                key={r.id}
                to={`/workspaces/${wsId}/workflows/${wfId}/runs/${r.id}`}
                className="flex items-center justify-between px-5 py-3 transition-colors hover:bg-canvas/70"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-ink tnum">#{r.run_number}</span>
                  <Badge tone="neutral" className="capitalize">{r.trigger}</Badge>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-faint">{fmtRelative(r.started_at ?? r.created_at)}</span>
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

function Toggle({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      role="switch"
      aria-checked={on}
      className={cn(
        "relative flex h-6 w-11 items-center rounded-full transition-all duration-200 focus-visible:outline-none focus-visible:shadow-focus shadow-inner",
        on ? "bg-gradient-to-r from-brand-600 to-indigo-600" : "bg-slate-200",
      )}
    >
      <span className={cn("inline-block h-4 w-4 rounded-full bg-white shadow-md transition-transform duration-200", on ? "translate-x-6" : "translate-x-1")} />
    </button>
  );
}
