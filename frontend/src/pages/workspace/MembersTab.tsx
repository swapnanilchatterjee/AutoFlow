import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Member } from "../../lib/types";
import { Badge, Button, Card, ErrorText, Input, Label, Modal } from "../../components/ui";

const ROLES = ["viewer", "member", "maintainer", "owner"];

export default function MembersTab({ wsId, canManage }: { wsId: string; canManage: boolean }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string | null>(null);

  function load() { api.workspaces.members.list(wsId).then(setMembers).catch(() => {}); }
  useEffect(() => { load(); }, [wsId]);

  async function add() {
    setError(null);
    try { await api.workspaces.members.add(wsId, { username, role }); setOpen(false); setUsername(""); load(); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">People with access to this workspace.</p>
        {canManage && <Button onClick={() => setOpen(true)}>Add member</Button>}
      </div>

      <Card className="divide-y divide-zinc-800">
        {members.map((m) => (
          <div key={m.id} className="flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-zinc-700 text-sm">
                {(m.user.full_name || m.user.username).charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-medium text-zinc-100">{m.user.full_name || m.user.username}</p>
                <p className="text-xs text-zinc-500">{m.user.email}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {canManage && m.role !== "owner" ? (
                <select
                  value={m.role}
                  onChange={async (e) => { await api.workspaces.members.update(wsId, m.id, e.target.value); load(); }}
                  className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 text-sm capitalize text-zinc-200 focus:border-emerald-500 focus:outline-none"
                >
                  {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                </select>
              ) : (
                <Badge className="capitalize">{m.role}</Badge>
              )}
              {canManage && m.role !== "owner" && (
                <button className="text-zinc-600 hover:text-red-400" onClick={async () => { await api.workspaces.members.remove(wsId, m.id); load(); }}>✕</button>
              )}
            </div>
          </div>
        ))}
      </Card>

      <Modal open={open} onClose={() => setOpen(false)} title="Add member">
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="space-y-4">
          <div><Label>Username or email</Label><Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="ada" /></div>
          <div>
            <Label>Role</Label>
            <select value={role} onChange={(e) => setRole(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm capitalize text-zinc-200 focus:border-emerald-500 focus:outline-none">
              {ROLES.filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="submit" disabled={!username}>Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
