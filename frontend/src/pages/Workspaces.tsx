import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Workspace } from "../lib/types";
import { Badge, Button, Card, EmptyState, ErrorText, Input, Label, Modal, Spinner, Textarea } from "../components/ui";

export default function Workspaces() {
  const navigate = useNavigate();
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
      navigate(`/workspaces/${ws.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Workspaces</h1>
          <p className="mt-1 text-sm text-zinc-500">Projects with files, workflows and secrets.</p>
        </div>
        <Button onClick={() => setOpen(true)}>New workspace</Button>
      </div>

      {!items ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No workspaces yet"
          hint="Create your first workspace to start building automations."
          action={<Button onClick={() => setOpen(true)}>New workspace</Button>}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((ws) => (
            <Link
              key={ws.id}
              to={`/workspaces/${ws.id}`}
              className="block hover:no-underline"
            >
              <Card className="cursor-pointer p-5 transition-colors hover:border-zinc-700">
                <div className="flex items-start justify-between">
                  <h3 className="font-semibold text-zinc-100">{ws.name}</h3>
                  {ws.role && <Badge>{ws.role}</Badge>}
                </div>
                <p className="mt-1 font-mono text-xs text-zinc-500">{ws.slug}</p>
                {ws.description && <p className="mt-3 line-clamp-2 text-sm text-zinc-400">{ws.description}</p>}
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New workspace">
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="My Project" /></div>
          <div><Label>Description</Label><Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={3} placeholder="Optional" /></div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={busy || !name}>{busy ? "Creating…" : "Create"}</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
