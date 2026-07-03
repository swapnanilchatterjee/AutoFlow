import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, FolderGit2, Plus } from "lucide-react";
import { api } from "../lib/api";
import type { Workspace } from "../lib/types";
import {
  Badge, Button, Card, EmptyState, ErrorText, Field, Input, Modal, PageHeader, Skeleton,
  Textarea, useToast,
} from "../components/ui";

export default function Workspaces() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<Workspace[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function load() { api.workspaces.list().then(setItems).catch((e) => setError(e.message)); }
  useEffect(() => { load(); }, []);

  async function create() {
    setError(null); setBusy(true);
    try {
      const ws = await api.workspaces.create({ name, description: desc || undefined });
      setOpen(false); setName(""); setDesc("");
      toast.success(`Workspace \u201c${ws.name}\u201d created`);
      navigate(`/workspaces/${ws.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div>
      <PageHeader
        title="Workspaces"
        description="Projects with files, workflows, secrets and integrations."
        actions={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New workspace</Button>}
      />

      {!items ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => <Skeleton key={i} className="h-[132px]" />)}
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<FolderGit2 className="h-5 w-5" />}
          title="No workspaces yet"
          description="Create your first workspace to start building automations."
          action={<Button onClick={() => setOpen(true)}><Plus className="h-4 w-4" /> New workspace</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ws) => (
            <Card
              key={ws.id}
              className="group cursor-pointer p-6 hover:-translate-y-1.5 hover:shadow-premium-hover transition-all duration-300"
              {...{ onClick: () => navigate(`/workspaces/${ws.id}`) }}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-indigo-50 text-brand dark:from-brand-500/10 dark:to-indigo-500/10 dark:text-brand-300 border border-brand-100/30 dark:border-brand-500/20 shadow-sm group-hover:shadow-md group-hover:scale-105 transition-all duration-200">
                  <FolderGit2 className="h-5 w-5" />
                </div>
                {ws.role && <Badge tone="brand">{ws.role}</Badge>}
              </div>
              <h3 className="mt-5 flex items-center gap-1.5 font-bold text-slate-800 dark:text-white group-hover:text-brand-600 dark:group-hover:text-brand-300 transition-colors">
                {ws.name}
                <ArrowRight className="h-4 w-4 -translate-x-1 text-brand opacity-0 transition-all group-hover:translate-x-1 group-hover:opacity-100" />
              </h3>
              <p className="mt-0.5 font-mono text-[11px] font-medium text-slate-400 dark:text-slate-500">{ws.slug}</p>
              {ws.description && <p className="mt-3 line-clamp-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{ws.description}</p>}
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New workspace"
        description="Give your project a name to get started."
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={create} disabled={busy || !name}>{busy ? "Creating\u2026" : "Create workspace"}</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <Field label="Name" htmlFor="ws-name"><Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="My Project" /></Field>
          <Field label="Description" htmlFor="ws-desc" help="Optional \u2014 describe what this workspace is for.">
            <Textarea id="ws-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Nightly reports and data pipelines" />
          </Field>
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>
    </div>
  );
}
