import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Workflow as WorkflowIcon } from "lucide-react";
import { api } from "../../lib/api";
import type { TriggerType, Workflow } from "../../lib/types";
import {
  Badge, Button, Card, EmptyState, ErrorText, Field, Input, Modal, Skeleton, StatusPill,
  cn, useToast,
} from "../../components/ui";

const STARTER = `name: My Workflow
env:
  GREETING: hello
steps:
  - name: Say hello
    run: echo "$GREETING from AutoFlow"

  # Deliver a report to Gmail / Telegram / WhatsApp.
  # Add a connection under the Integrations tab first, then:
  # - name: Email the report
  #   uses: gmail            # or: telegram / whatsapp
  #   with:
  #     to: [you@example.com]
  #     subject: Daily report
  #     body: "Attached is today's report."
  #     attachments: [report.txt]
`;

const TRIGGERS: TriggerType[] = ["manual", "schedule", "webhook"];

export default function WorkflowsTab({ wsId, canWrite }: { wsId: string; canWrite: boolean }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<Workflow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("manual");
  const [cron, setCron] = useState("0 * * * *");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() { api.workflows.list(wsId).then(setItems).catch((e) => setError(e.message)); }
  useEffect(() => { load(); }, [wsId]);

  async function create() {
    setError(null); setBusy(true);
    try {
      const wf = await api.workflows.create(wsId, {
        name, definition: STARTER, trigger_type: trigger,
        schedule_cron: trigger === "schedule" ? cron : undefined,
      });
      setOpen(false); setName("");
      toast.success(`Workflow "${wf.name}" created`);
      navigate(`/workspaces/${wsId}/workflows/${wf.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Automations that run a sequence of shell steps and deliver reports.</p>
        {canWrite && <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New workflow</Button>}
      </div>

      {!items ? (
        <div className="space-y-2">{[0, 1].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<WorkflowIcon className="h-5 w-5" />}
          title="No workflows yet"
          description="Create a workflow to automate builds, jobs and scheduled reports."
          action={canWrite ? <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New workflow</Button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {items.map((wf) => (
            <Card
              key={wf.id}
              className="group flex cursor-pointer items-center justify-between p-5 hover:-translate-y-0.5 hover:shadow-premium-hover transition-all duration-200"
              {...{ onClick: () => navigate(`/workspaces/${wsId}/workflows/${wf.id}`) }}
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-indigo-50 text-brand dark:from-brand-500/10 dark:to-indigo-500/10 dark:text-brand-300 border border-brand-100/30 dark:border-brand-500/20 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                  <WorkflowIcon className="h-5 w-5" />
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">{wf.name}</p>
                  <p className="font-mono text-[11px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{wf.slug}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Badge tone="neutral" className="capitalize text-xs">{wf.trigger_type}</Badge>
                {!wf.enabled && <StatusPill status="cancelled" />}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New workflow"
        description="You can edit the steps after creating it."
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={create} disabled={busy || !name}>{busy ? "Creating…" : "Create workflow"}</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <Field label="Name" htmlFor="wf-name"><Input id="wf-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="My Workflow" /></Field>
          <Field label="Trigger">
            <div className="grid grid-cols-3 gap-2">
              {TRIGGERS.map((t) => (
                <button
                  key={t} type="button" onClick={() => setTrigger(t)}
                  className={cn(
                    "rounded-lg border px-3 py-2 text-sm capitalize transition-colors",
                    trigger === t
                      ? "border-brand bg-brand-50 text-brand-700"
                      : "border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 hover:border-[#DDE1E7] dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white",
                  )}
                >
                  {t}
                </button>
              ))}
            </div>
          </Field>
          {trigger === "schedule" && (
            <Field label="Cron schedule" htmlFor="wf-cron" help="Standard 5-field cron, evaluated in UTC.">
              <Input id="wf-cron" value={cron} onChange={(e) => setCron(e.target.value)} className="font-mono" placeholder="0 * * * *" />
            </Field>
          )}
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>
    </div>
  );
}
