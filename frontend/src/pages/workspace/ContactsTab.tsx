import { useEffect, useState } from "react";
import { Contact, Mail, Phone, Plus, Search, Trash2, User } from "lucide-react";
import { api } from "../../lib/api";
import {
  Badge, Button, Card, EmptyState, ErrorText, Field, Input, Modal, Skeleton,
  Table, TBody, TD, TH, THead, TR, useToast,
} from "../../components/ui";

interface ContactRecord {
  name: string;
  email: string;
  phone: string;
  groups: string[];
}

export default function ContactsTab({ wsId, canManage }: { wsId: string; canManage: boolean }) {
  const toast = useToast();
  const [contacts, setContacts] = useState<ContactRecord[] | null>(null);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  // Form states
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [groupStr, setGroupStr] = useState("");

  const load = async () => {
    try {
      const file = await api.files.read(wsId, "contacts.json");
      const parsed = JSON.parse(file.content);
      setContacts(parsed.contacts || []);
    } catch (e: any) {
      if (e.status === 404) {
        setContacts([]); // File not created yet is fine
      } else {
        setError(e.message || "Failed to load contacts");
        setContacts([]);
      }
    }
  };

  useEffect(() => { load(); }, [wsId]);

  const saveContacts = async (nextList: ContactRecord[]) => {
    try {
      setError(null);
      await api.files.write(
        wsId,
        "contacts.json",
        JSON.stringify({ contacts: nextList }, null, 2)
      );
      setContacts(nextList);
      return true;
    } catch (e: any) {
      setError(e.message || "Failed to save contacts");
      return false;
    }
  };

  const openAdd = () => {
    setEditingIndex(null);
    setName("");
    setEmail("");
    setPhone("");
    setGroupStr("");
    setOpen(true);
  };

  const openEdit = (c: ContactRecord, idx: number) => {
    setEditingIndex(idx);
    setName(c.name);
    setEmail(c.email);
    setPhone(c.phone);
    setGroupStr(c.groups.join(", "));
    setOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const newContact: ContactRecord = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      groups: groupStr.split(",").map(g => g.trim().toLowerCase()).filter(Boolean),
    };

    let nextList = [...(contacts || [])];
    if (editingIndex !== null) {
      nextList[editingIndex] = newContact;
      toast.success("Contact updated");
    } else {
      nextList.push(newContact);
      toast.success("Contact added");
    }

    const success = await saveContacts(nextList);
    if (success) {
      setOpen(false);
    }
  };

  const handleDelete = async (idx: number) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;
    const nextList = (contacts || []).filter((_, i) => i !== idx);
    const success = await saveContacts(nextList);
    if (success) {
      toast.success("Contact deleted");
    }
  };

  const filtered = (contacts || []).filter(c => {
    const q = query.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.email.toLowerCase().includes(q) ||
      c.phone.toLowerCase().includes(q) ||
      c.groups.some(g => g.toLowerCase().includes(q))
    );
  });

  // Get all unique groups for quick filtering/viewing
  const allGroups = Array.from(new Set((contacts || []).flatMap(c => c.groups)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Manage recipient contacts and group lists. Reference groups in workflow templates 
          (e.g., using <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[12px] text-slate-900 dark:text-white">@team</code> or <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[12px] text-slate-900 dark:text-white">team</code> in the "to" parameter) to send bulk emails or WhatsApp notifications.
        </p>
        {canManage && (
          <Button onClick={openAdd} className="shrink-0">
            <Plus className="h-4 w-4" /> Add contact
          </Button>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search contacts or groups..."
            className="pl-10"
          />
        </div>
        {allGroups.length > 0 && (
          <div className="flex items-center gap-1.5 overflow-x-auto py-1 scroll-slim">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider mr-1">Groups:</span>
            {allGroups.map(g => (
              <button
                key={g}
                onClick={() => setQuery(g)}
                className="inline-flex items-center rounded-full bg-slate-100 dark:bg-slate-800 hover:bg-brand-50 dark:hover:bg-brand-950 hover:text-brand-700 dark:hover:text-brand-300 px-2.5 py-0.5 text-xs font-medium text-slate-600 dark:text-slate-400 transition-colors"
              >
                {g}
              </button>
            ))}
            {query && (
              <button
                onClick={() => setQuery("")}
                className="text-xs text-brand hover:underline font-semibold"
              >
                Clear filter
              </button>
            )}
          </div>
        )}
      </div>

      {!contacts ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : contacts.length === 0 ? (
        <EmptyState
          icon={<Contact className="h-5 w-5" />}
          title="No contacts yet"
          description="Create contact lists to reference team members or groups in your messaging templates."
          action={canManage ? <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add contact</Button> : undefined}
        />
      ) : filtered.length === 0 ? (
        <p className="py-12 text-center text-sm text-slate-500 dark:text-slate-400">No contacts match your search.</p>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto scroll-slim">
            <Table className="min-w-[700px]">
              <THead>
                <TR>
                  <TH>Name</TH>
                  <TH>Email</TH>
                  <TH>Phone number</TH>
                  <TH>Groups</TH>
                  {canManage && <TH className="w-24 text-right">Actions</TH>}
                </TR>
              </THead>
              <TBody>
                {filtered.map((c, idx) => {
                  const actualIndex = contacts.indexOf(c);
                  const initials = c.name
                    .split(" ")
                    .map(n => n[0])
                    .join("")
                    .substring(0, 2)
                    .toUpperCase();
                  return (
                    <TR key={idx} className="group/row">
                      <TD>
                        <div className="flex items-center gap-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-tr from-brand-50 to-indigo-50 text-[13px] font-bold text-brand border border-brand-100/30">
                            {initials || <User className="h-4 w-4" />}
                          </div>
                          <span className="font-semibold text-slate-800 dark:text-slate-200">{c.name}</span>
                        </div>
                      </TD>
                      <TD>
                        {c.email ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400">
                            <Mail className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            {c.email}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </TD>
                      <TD>
                        {c.phone ? (
                          <span className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-mono text-[13px]">
                            <Phone className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                            {c.phone}
                          </span>
                        ) : (
                          <span className="text-slate-300 dark:text-slate-600">—</span>
                        )}
                      </TD>
                      <TD>
                        <div className="flex flex-wrap gap-1">
                          {c.groups.map(g => (
                            <Badge key={g} tone="neutral" className="capitalize text-[10px] px-1.5 py-0">
                              {g}
                            </Badge>
                          ))}
                          {c.groups.length === 0 && <span className="text-slate-300 dark:text-slate-600">—</span>}
                        </div>
                      </TD>
                      {canManage && (
                        <TD className="text-right">
                          <div className="flex items-center justify-end gap-1.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                            <Button size="sm" variant="ghost" onClick={() => openEdit(c, actualIndex)}>
                              Edit
                            </Button>
                            <button
                              onClick={() => handleDelete(actualIndex)}
                              className="text-slate-400 dark:text-slate-500 hover:text-red-600 dark:hover:text-red-400 p-1.5 rounded-lg transition-colors hover:bg-red-50 dark:hover:bg-red-950"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </TD>
                      )}
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        </Card>
      )}

      {error && <ErrorText>{error}</ErrorText>}

      {/* Add / edit Modal */}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingIndex !== null ? "Edit Contact" : "Add New Contact"}
        description="Save contacts to create bulk messaging lists."
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setOpen(false)}>Cancel</Button>
            <Button type="button" onClick={handleSubmit} disabled={!name}>
              {editingIndex !== null ? "Save Changes" : "Add Contact"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Field label="Full name" htmlFor="ct-name">
            <Input
              id="ct-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Alice Johnson"
              autoFocus
            />
          </Field>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Email address" htmlFor="ct-email">
              <Input
                id="ct-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
              />
            </Field>
            <Field label="Phone number" htmlFor="ct-phone" help="Include international prefix (e.g. 91...) for WhatsApp.">
              <Input
                id="ct-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="919876543210"
              />
            </Field>
          </div>
          <Field label="Groups" htmlFor="ct-groups" help="Comma-separated labels to categorize this contact (e.g., team, billing, users).">
            <Input
              id="ct-groups"
              value={groupStr}
              onChange={(e) => setGroupStr(e.target.value)}
              placeholder="team, alerts"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}
