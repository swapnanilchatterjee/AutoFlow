import { useEffect, useState } from "react";
import { Trash2, UserPlus } from "lucide-react";
import { api } from "../../lib/api";
import type { Member } from "../../lib/types";
import {
  Avatar, Badge, Button, Card, ErrorText, Field, IconButton, Input, Modal, Select, useToast,
  fmtRelative,
} from "../../components/ui";

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
        <p className="text-sm text-slate-500 dark:text-slate-400">People with access to this workspace.</p>
        {canManage && <Button onClick={() => setOpen(true)}><UserPlus className="h-4 w-4" /> Add member</Button>}
      </div>

      <Card className="divide-y divide-slate-100 dark:divide-slate-800">
        {members.map((m) => {
          const label = m.user.full_name || m.user.username;
          return (
            <div key={m.id} className="flex items-center justify-between p-4">
              <div className="flex items-center gap-3">
                <Avatar name={label} />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-white">{label}</p>
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 flex-wrap">
                    <span>{m.user.email}</span>
                    <span>•</span>
                    <span title={m.user.last_password_changed ? new Date(m.user.last_password_changed).toLocaleString() : "Never (never changed or updated)"} className="cursor-help hover:text-slate-600 dark:hover:text-slate-400 transition-colors">
                      Password changed: {m.user.last_password_changed ? fmtRelative(m.user.last_password_changed) : "Never"}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {canManage ? (
                  <div className="w-36">
                    <Select
                      value={m.role}
                      onChange={async (e) => {
                        try {
                          await api.workspaces.members.update(wsId, m.id, e.target.value);
                          toast.success("Role updated successfully");
                          load();
                        } catch (err: any) {
                          toast.error(err.message || "Failed to update role");
                        }
                      }}
                      className="capitalize"
                    >
                      <option value="viewer">read</option>
                      <option value="member">write</option>
                      <option value="maintainer">edit</option>
                      <option value="maintainer">coadmin</option>
                      <option value="owner">owner</option>
                    </Select>
                  </div>
                ) : (
                  <Badge tone={m.role === "owner" ? "brand" : "neutral"} className="capitalize">
                    {m.role === "viewer" ? "read" : m.role === "member" ? "write" : m.role === "maintainer" ? "coadmin" : m.role}
                  </Badge>
                )}
                {canManage && m.role !== "owner" && (
                  <IconButton
                    className="hover:bg-red-50 dark:hover:bg-red-950 hover:text-red-600 dark:hover:text-red-400"
                    onClick={async () => {
                      try {
                        await api.workspaces.members.remove(wsId, m.id);
                        toast.success("Member removed");
                        load();
                      } catch (err: any) {
                        toast.error(err.message || "Failed to remove member");
                      }
                    }}
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
              <option value="viewer">read</option>
              <option value="member">write</option>
              <option value="maintainer">edit</option>
              <option value="maintainer">coadmin</option>
              <option value="owner">owner</option>
            </Select>
          </Field>
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>
    </div>
  );
}
