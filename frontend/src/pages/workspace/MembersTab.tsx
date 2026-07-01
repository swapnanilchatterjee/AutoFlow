import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { api } from "../../lib/api";
import type { Member } from "../../lib/types";
import {
  Avatar, Badge, Button, Card, ErrorText, Field, IconButton, Input, Modal, Select, useToast,
} from "../../components/ui";

const ROLES = ["viewer", "member", "maintainer", "owner"];

export default function MembersTab({ wsId, canManage }: { wsId: string; canManage: boolean }) {
  const toast = useToast();
  const [members, setMembers] = useState<Member[]>([]);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState("");
  const [role, setRole] = useState("member");
  const [error, setError] = useState<string | null>(null);

  function load() { api.workspaces.members.list(wsId).then(setMembers).catch(() => {}); }
  useEffect(() => { load(); }, [wsId]);

  async function add() {
    setError(null);
    try {
      await api.workspaces.members.add(wsId, { username, role });
      toast.success(`${username} added as ${role}`);
      setOpen(false); setUsername(""); load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-muted">People with access to this workspace.</p>
        {canManage && <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add member</Button>}
      </div>

      <Card className="divide-y divide-hairline">
        {members.map((m) => {
          const label = m.user.full_name || m.user.username;
          return (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Avatar name={label} />
                <div>
                  <p className="text-sm font-medium text-ink">{label}</p>
                  <p className="text-xs text-muted">{m.user.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage && m.role !== "owner" ? (
                  <div className="w-36">
                    <Select
                      value={m.role}
                      onChange={async (e) => { await api.workspaces.members.update(wsId, m.id, e.target.value); toast.success("Role updated"); load(); }}
                      className="capitalize"
                    >
                      {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </Select>
                  </div>
                ) : (
                  <Badge tone={m.role === "owner" ? "brand" : "neutral"} className="capitalize">{m.role}</Badge>
                )}
                {canManage && m.role !== "owner" && (
                  <IconButton
                    className="hover:bg-danger-50 hover:text-danger"
                    onClick={async () => { await api.workspaces.members.remove(wsId, m.id); toast.success("Member removed"); load(); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                )}
              </div>
            </div>
          );
        })}
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add member"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={add} disabled={!username}>Add member</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); add(); }} className="space-y-4">
          <Field label="Username or email" htmlFor="mem-user"><Input id="mem-user" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="ada" /></Field>
          <Field label="Role" htmlFor="mem-role">
            <Select id="mem-role" value={role} onChange={(e) => setRole(e.target.value)} className="capitalize">
              {ROLES.filter((r) => r !== "owner").map((r) => <option key={r} value={r}>{r}</option>)}
            </Select>
          </Field>
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>
    </div>
  );
}
