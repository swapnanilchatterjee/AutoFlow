import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle } from "lucide-react";
import { api } from "../../lib/api";
import type { Workspace } from "../../lib/types";
import {
  Button, Card, CardBody, CardHeader, ErrorText, Field, Input, Textarea, useToast,
} from "../../components/ui";

export default function SettingsTab({ ws, isOwner, onUpdated }: { ws: Workspace; isOwner: boolean; onUpdated: () => void }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [name, setName] = useState(ws.name);
  const [desc, setDesc] = useState(ws.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    setError(null); setBusy(true);
    try { await api.workspaces.update(ws.id, { name, description: desc }); toast.success("Changes saved"); onUpdated(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }
  async function remove() {
    if (!confirm(`Permanently delete "${ws.name}" and all its files, workflows and secrets?`)) return;
    await api.workspaces.remove(ws.id);
    navigate("/workspaces");
  }

  return (
    <div className="max-w-xl space-y-5">
      <Card>
        <CardHeader title="General" description="Basic details for this workspace." />
        <CardBody className="space-y-4">
          <Field label="Name" htmlFor="set-name"><Input id="set-name" value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} /></Field>
          <Field label="Description" htmlFor="set-desc"><Textarea id="set-desc" value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} disabled={!isOwner} /></Field>
          <ErrorText>{error}</ErrorText>
          {isOwner && (
            <div className="flex items-center justify-end">
              <Button onClick={save} disabled={busy || !name}>{busy ? "Saving…" : "Save changes"}</Button>
            </div>
          )}
        </CardBody>
      </Card>

      {isOwner && (
        <Card className="border-red-100 dark:border-red-900">
          <CardHeader
            title={<span className="flex items-center gap-2 text-red-600 dark:text-red-400"><AlertTriangle className="h-4 w-4" /> Danger zone</span>}
          />
          <CardBody className="flex items-center justify-between gap-4">
            <p className="text-sm text-slate-500 dark:text-slate-400">Delete this workspace and everything in it. This cannot be undone.</p>
            <Button variant="danger" onClick={remove} className="shrink-0">Delete workspace</Button>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
