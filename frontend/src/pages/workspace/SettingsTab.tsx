import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import type { Workspace } from "../../lib/types";
import { Button, Card, ErrorText, Input, Label, Textarea } from "../../components/ui";

export default function SettingsTab({ ws, isOwner, onUpdated }: { ws: Workspace; isOwner: boolean; onUpdated: () => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(ws.name);
  const [desc, setDesc] = useState(ws.description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function save() {
    setError(null); setSaved(false);
    try { await api.workspaces.update(ws.id, { name, description: desc }); setSaved(true); onUpdated(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }
  async function remove() {
    if (!confirm(`Permanently delete "${ws.name}" and all its files, workflows and secrets?`)) return;
    await api.workspaces.remove(ws.id);
    navigate("/workspaces");
  }

  return (
    <div className="max-w-xl space-y-5">
      <Card className="p-5">
        <h3 className="mb-4 text-sm font-semibold text-zinc-200">General</h3>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} disabled={!isOwner} /></div>
          <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} disabled={!isOwner} /></div>
          <ErrorText>{error}</ErrorText>
          {isOwner && (
            <div className="flex items-center justify-end gap-3">
              {saved && <span className="text-sm text-emerald-400">Saved</span>}
              <Button onClick={save}>Save changes</Button>
            </div>
          )}
        </div>
      </Card>

      {isOwner && (
        <Card className="border-red-500/30 p-5">
          <h3 className="text-sm font-semibold text-red-400">Danger zone</h3>
          <div className="mt-3 flex items-center justify-between">
            <p className="text-sm text-zinc-400">Delete this workspace and everything in it.</p>
            <Button variant="danger" onClick={remove}>Delete workspace</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
