import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Plus, Workflow as WorkflowIcon, Download, Upload,
  HardDrive, FileSpreadsheet, Activity, GitMerge, Trash2, Webhook,
} from "lucide-react";
import { api } from "../../lib/api";
import type { TriggerType, Workflow } from "../../lib/types";
import { WORKFLOW_TEMPLATES } from "../../lib/templates";
import type { WorkflowTemplate } from "../../lib/templates";
import {
  Badge, Button, Card, EmptyState, ErrorText, Field, Input, Modal, Skeleton, StatusPill,
  cn, useToast,
} from "../../components/ui";

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  HardDrive, FileSpreadsheet, Activity, GitMerge, Trash2, Webhook,
};

function tmplIcon(template: WorkflowTemplate) {
  const Icon = ICON_MAP[template.icon];
  if (!Icon) return <WorkflowIcon className="h-5 w-5" />;
  return <Icon className="h-5 w-5" />;
}

function detectTriggerType(definition: string): TriggerType {
  const m = definition.match(/trigger:\s*\n\s+type:\s*(\w+)/);
  if (m && (m[1] === "schedule" || m[1] === "webhook")) return m[1] as TriggerType;
  return "manual";
}

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
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<Workflow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [templateOpen, setTemplateOpen] = useState(false);
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

  async function createFromTemplate(template: WorkflowTemplate) {
    setError(null); setBusy(true);
    try {
      const triggerType = detectTriggerType(template.definition);
      const wf = await api.workflows.create(wsId, {
        name: template.name,
        definition: template.definition,
        trigger_type: triggerType,
      });
      setTemplateOpen(false);
      toast.success(`Workflow "${wf.name}" created from template`);
      navigate(`/workspaces/${wsId}/workflows/${wf.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  function exportWorkflow(wf: Workflow) {
    const blob = new Blob([wf.definition], { type: "text/yaml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${wf.slug || wf.name}.yaml`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const name = file.name.replace(/\.(yaml|yml)$/, "");
    try {
      await api.workflows.create(wsId, { name, definition: text, trigger_type: "manual" });
      toast.success(`Workflow "${name}" imported`);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Import failed");
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-slate-500 dark:text-slate-400">Automations that run a sequence of shell steps and deliver reports.</p>
        {canWrite && (
          <div className="flex items-center gap-2">
            <input type="file" accept=".yaml,.yml" className="hidden" onChange={handleImport} ref={fileInputRef} />
            <Button variant="secondary" onClick={() => fileInputRef.current?.click()}><Upload className="h-4 w-4" /> Import</Button>
            <Button variant="outline" onClick={() => setTemplateOpen(true)}><WorkflowIcon className="h-4 w-4" /> From template</Button>
            <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New workflow</Button>
          </div>
        )}
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
                <Button size="sm" variant="ghost" onClick={(e) => { e.stopPropagation(); exportWorkflow(wf); }}>
                  <Download className="h-4 w-4" />
                </Button>
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

      <Modal
        open={templateOpen}
        onClose={() => { setTemplateOpen(false); setError(null); }}
        title="New workflow from template"
        description="Choose a template to get started quickly."
        size="lg"
      >
        <div className="grid grid-cols-2 gap-4">
          {WORKFLOW_TEMPLATES.map((t) => (
            <button
              key={t.id}
              type="button"
              disabled={busy}
              onClick={() => createFromTemplate(t)}
              className="group flex flex-col items-start gap-3 rounded-2xl border border-slate-200 bg-white p-5 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-brand-300 hover:shadow-premium-hover dark:border-slate-800 dark:bg-slate-900 dark:hover:border-brand-500"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-indigo-50 text-brand dark:from-brand-500/10 dark:to-indigo-500/10 dark:text-brand-300 border border-brand-100/30 dark:border-brand-500/20 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                  {tmplIcon(t)}
                </div>
                <div>
                  <p className="font-bold text-slate-800 dark:text-slate-200 group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">{t.name}</p>
                  <Badge tone="brand" className="mt-0.5 text-[10px]">{t.category}</Badge>
                </div>
              </div>
              <p className="text-sm leading-relaxed text-slate-500 dark:text-slate-400">{t.description}</p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
