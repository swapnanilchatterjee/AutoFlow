import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Mail, MessageCircle, MoreVertical, Pencil, Plus, Send,
  SendHorizontal, Trash2, Clock,
} from "lucide-react";
import { Cron } from "croner";
import { api } from "../../lib/api";
import type { ChannelCatalogItem, Connection } from "../../lib/types";
import {
  Badge, Button, Card, EmptyState, ErrorText, Field, Help, IconButton, Input, Menu,
  MenuItem, MenuSeparator, Modal, Skeleton, cn, fmtRelative, useToast, Select,
} from "../../components/ui";

const META: Record<string, { icon: typeof Mail; tint: string; blurb: string }> = {
  gmail: { icon: Mail, tint: "bg-danger-50 text-danger", blurb: "Send email via SMTP using a Gmail App Password." },
  telegram: { icon: Send, tint: "bg-info-50 text-info", blurb: "Post messages and documents through a Telegram bot." },
  whatsapp: { icon: MessageCircle, tint: "bg-ok-50 text-ok", blurb: "Deliver messages via the WhatsApp Cloud API." },
};

interface FormState {
  type: string | null;
  name: string;
  config: Record<string, string>;
  enabled: boolean;
  schedule_cron: string;
  schedule_tz: string;
  schedule_to: string;
}
const EMPTY: FormState = { type: null, name: "", config: {}, enabled: true, schedule_cron: "", schedule_tz: "UTC", schedule_to: "" };

export default function IntegrationsTab({ wsId, canManage }: { wsId: string; canManage: boolean }) {
  const toast = useToast();
  const [catalog, setCatalog] = useState<ChannelCatalogItem[] | null>(null);
  const [conns, setConns] = useState<Connection[] | null>(null);

  const [form, setForm] = useState<FormState | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [testing, setTesting] = useState<Connection | null>(null);
  const [testTo, setTestTo] = useState("");
  const [testAttach, setTestAttach] = useState(false);
  const [testBusy, setTestBusy] = useState(false);

  const catalogByType = useMemo(
    () => Object.fromEntries((catalog ?? []).map((c) => [c.type, c])),
    [catalog],
  );

  function loadConns() { api.connections.list(wsId).then(setConns).catch(() => setConns([])); }
  useEffect(() => {
    api.connections.catalog(wsId).then(setCatalog).catch(() => setCatalog([]));
    loadConns();
  }, [wsId]);

  function openAdd() { setEditingId(null); setError(null); setForm({ ...EMPTY, config: {} }); }
  function openEdit(c: Connection) {
    setEditingId(c.id); setError(null);
    setForm({
      type: c.type,
      name: c.name,
      config: {},
      enabled: c.enabled,
      schedule_cron: c.schedule_cron ?? "",
      schedule_tz: c.schedule_tz ?? "UTC",
      schedule_to: c.schedule_to ?? "",
    });
  }
  function pickType(type: string) {
    setForm((f) => (f ? { ...f, type, name: f.name || defaultName(type, conns) } : f));
  }

  async function submit() {
    if (!form?.type) return;
    setError(null); setBusy(true);
    try {
      if (editingId) {
        await api.connections.update(wsId, editingId, {
          name: form.name,
          config: form.config,
          enabled: form.enabled,
          schedule_cron: form.schedule_cron || null,
          schedule_tz: form.schedule_tz || "UTC",
          schedule_to: form.schedule_to || null,
        });
        toast.success(`"${form.name}" updated`);
      } else {
        await api.connections.create(wsId, {
          type: form.type,
          name: form.name,
          config: form.config,
          schedule_cron: form.schedule_cron || null,
          schedule_tz: form.schedule_tz || "UTC",
          schedule_to: form.schedule_to || null,
        });
        toast.success(`${catalogByType[form.type]?.label ?? form.type} connected`);
      }
      setForm(null); setEditingId(null); loadConns();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  async function toggle(c: Connection) {
    await api.connections.update(wsId, c.id, { enabled: !c.enabled });
    toast.success(c.enabled ? `"${c.name}" disabled` : `"${c.name}" enabled`);
    loadConns();
  }
  async function remove(c: Connection) {
    if (!confirm(`Delete the "${c.name}" connection?`)) return;
    await api.connections.remove(wsId, c.id);
    toast.success(`"${c.name}" deleted`);
    loadConns();
  }
  async function runTest() {
    if (!testing) return;
    setTestBusy(true);
    try {
      const r = await api.connections.test(wsId, testing.id, testTo, testAttach);
      if (r.ok) toast.success(r.detail); else toast.error(r.detail);
      if (r.ok) { setTesting(null); setTestTo(""); setTestAttach(false); }
    } catch (e) { toast.error(e instanceof Error ? e.message : "Test failed"); }
    finally { setTestBusy(false); }
  }

  const activeCatalog = form?.type ? catalogByType[form.type] : null;

  return (
    <div className="space-y-4">
      <div className="flex items-start justify-between gap-4">
        <p className="max-w-2xl text-sm text-slate-500 dark:text-slate-400">
          Connect messaging channels so a workflow can deliver reports. Reference a channel from a
          workflow step with <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[12px] text-slate-900 dark:text-white">uses: gmail</code> and a{" "}
          <code className="rounded bg-slate-100 dark:bg-slate-800 px-1 py-0.5 font-mono text-[12px] text-slate-900 dark:text-white">with:</code> block.
        </p>
        {canManage && <Button onClick={openAdd} className="shrink-0"><Plus className="h-4 w-4" /> Add connection</Button>}
      </div>

      {!conns ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{[0, 1].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : conns.length === 0 ? (
        <EmptyState
          icon={<Send className="h-5 w-5" />}
          title="No connections yet"
          description="Add a Gmail, Telegram or WhatsApp connection to start delivering reports from your workflows."
          action={canManage ? <Button onClick={openAdd}><Plus className="h-4 w-4" /> Add connection</Button> : undefined}
        />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {conns.map((c) => {
            const meta = META[c.type] ?? META.gmail;
            const Icon = meta.icon;
            const cat = catalogByType[c.type];
            const summary = Object.entries(c.config_summary).filter(([, v]) => v);
            return (
              <Card key={c.id} className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", meta.tint)}>
                      <Icon className="h-[18px] w-[18px]" />
                    </div>
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                      <p className="text-xs text-slate-400 dark:text-slate-500">{cat?.label ?? c.type}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Badge tone={c.enabled ? "ok" : "neutral"}>{c.enabled ? "Enabled" : "Disabled"}</Badge>
                    {canManage && (
                      <Menu
                        align="right"
                        trigger={<IconButton><MoreVertical className="h-4 w-4" /></IconButton>}
                      >
                        <MenuItem icon={<SendHorizontal className="h-4 w-4" />} onClick={() => { setTesting(c); setTestTo(""); }}>
                          Send test
                        </MenuItem>
                        <MenuItem icon={<Pencil className="h-4 w-4" />} onClick={() => openEdit(c)}>Edit</MenuItem>
                        <MenuItem onClick={() => toggle(c)}>{c.enabled ? "Disable" : "Enable"}</MenuItem>
                        <MenuSeparator />
                        <MenuItem icon={<Trash2 className="h-4 w-4" />} danger onClick={() => remove(c)}>Delete</MenuItem>
                      </Menu>
                    )}
                  </div>
                </div>

                {summary.length > 0 && (
                  <dl className="mt-3 space-y-1 border-t border-slate-100 dark:border-slate-800 pt-3">
                    {summary.map(([k, v]) => (
                      <div key={k} className="flex items-center justify-between gap-3 text-xs">
                        <dt className="text-slate-400 dark:text-slate-500">{cat?.config_fields.find((f) => f.key === k)?.label ?? k}</dt>
                        <dd className="truncate font-mono text-slate-500 dark:text-slate-400">{v}</dd>
                      </div>
                    ))}
                  </dl>
                )}

                {c.schedule_cron && (
                  <div className="mt-3 rounded-lg bg-slate-50/70 dark:bg-slate-900/70 p-2.5 border border-slate-100/80 dark:border-slate-800/80 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600 dark:text-slate-400 font-medium">
                      <Clock className="h-3.5 w-3.5 text-slate-400 dark:text-slate-500" />
                      <span>Scheduled Check: <code className="font-mono text-slate-800 dark:text-slate-200 bg-slate-200/60 dark:bg-slate-700/60 px-1 py-0.5 rounded">{c.schedule_cron}</code> ({c.schedule_tz})</span>
                    </div>
                    {c.schedule_to && (
                      <div className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 pl-5">
                        Recipient: <span className="font-mono text-slate-700 dark:text-slate-300 font-medium">{c.schedule_to}</span>
                      </div>
                    )}
                  </div>
                )}
                <p className="mt-3 text-[11px] text-slate-400 dark:text-slate-500">Updated {fmtRelative(c.updated_at)}</p>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / edit modal */}
      <Modal
        open={form !== null}
        onClose={() => setForm(null)}
        title={
          editingId
            ? `Edit ${activeCatalog?.label ?? "connection"}`
            : activeCatalog
              ? (
                <span className="flex items-center gap-2">
                  <button onClick={() => setForm({ ...EMPTY, config: {} })} className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white">
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  Connect {activeCatalog.label}
                </span>
              )
              : "Add a connection"
        }
        description={
          !editingId && !activeCatalog
            ? "Choose a channel to connect."
            : activeCatalog
              ? META[activeCatalog.type]?.blurb
              : undefined
        }
        footer={
          activeCatalog ? (
            <>
              <Button variant="secondary" type="button" onClick={() => setForm(null)}>Cancel</Button>
              <Button type="button" onClick={submit} disabled={busy || !form?.name}>
                {busy ? "Saving…" : editingId ? "Save changes" : "Connect"}
              </Button>
            </>
          ) : undefined
        }
      >
        {!activeCatalog ? (
          <div className="grid gap-2">
            {(catalog ?? []).map((c) => {
              const meta = META[c.type] ?? META.gmail;
              const Icon = meta.icon;
              return (
                <button
                  key={c.type}
                  onClick={() => pickType(c.type)}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-slate-800 p-3 text-left transition-colors hover:border-brand hover:bg-brand-50/40"
                >
                  <div className={cn("flex h-10 w-10 items-center justify-center rounded-lg", meta.tint)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{c.label}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{meta.blurb}</p>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
            <Field label="Connection name" htmlFor="cn-name" help="A label to reference this channel (e.g. reports, team-alerts).">
              <Input
                id="cn-name"
                value={form?.name ?? ""}
                onChange={(e) => setForm((f) => (f ? { ...f, name: e.target.value } : f))}
                autoFocus
                placeholder="reports"
              />
            </Field>
            {activeCatalog.config_fields.map((fld) => (
              <Field key={fld.key} label={fld.label + (fld.required ? "" : " (optional)")} htmlFor={`cn-${fld.key}`} help={fld.help}>
                <Input
                  id={`cn-${fld.key}`}
                  type={fld.secret ? "password" : "text"}
                  value={form?.config[fld.key] ?? ""}
                  onChange={(e) => setForm((f) => (f ? { ...f, config: { ...f.config, [fld.key]: e.target.value } } : f))}
                  placeholder={editingId && fld.secret ? "•••••• (leave blank to keep)" : fld.placeholder}
                  className={fld.secret ? "font-mono" : undefined}
                />
              </Field>
            ))}
            <div className="rounded-lg bg-slate-50 dark:bg-slate-950 px-3 py-2">
              <Help>In a workflow: <code className="font-mono text-slate-900 dark:text-white">uses: {activeCatalog.type}</code> · <span className="font-mono text-slate-900 dark:text-white">{activeCatalog.send_hint}</span></Help>
            </div>
            {activeCatalog.type === "gmail" && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200">Gmail / SMTP Setup Guide:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Go to your Google Account Settings page.</li>
                  <li>Enable <strong>2-Step Verification</strong> if not already active.</li>
                  <li>Search for <strong>App Passwords</strong> in the top search bar.</li>
                  <li>Create a new app password (e.g. name it "AutoFlow") and copy the 16-character code.</li>
                  <li>Paste this code as your <strong>Password</strong> here, with your Gmail address as <strong>User</strong>.</li>
                </ol>
              </div>
            )}
            {activeCatalog.type === "telegram" && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200">Telegram Bot Setup Guide:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Search for <strong>@BotFather</strong> inside Telegram and start a chat.</li>
                  <li>Send the command <code>/newbot</code>, choose a name and username for your bot, and copy the <strong>HTTP API Token</strong>.</li>
                  <li>Search for your bot's username and click <strong>Start</strong> to activate it.</li>
                  <li>To retrieve your <strong>Chat ID</strong>, forward any message from your chat to <strong>@userinfobot</strong>, or post to your target channel and copy its username (e.g. <code>@my_channel</code>).</li>
                </ol>
              </div>
            )}
            {activeCatalog.type === "whatsapp" && (
              <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/50 p-4 text-xs text-slate-600 dark:text-slate-400 space-y-2">
                <p className="font-bold text-slate-800 dark:text-slate-200">WhatsApp Cloud API Setup Guide:</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Go to the <strong>Meta for Developers</strong> console and create a Business App.</li>
                  <li>Add the <strong>WhatsApp</strong> product to your Meta application.</li>
                  <li>Copy the <strong>Access Token</strong>, the <strong>Phone Number ID</strong>, and the <strong>WhatsApp Business Account ID</strong>.</li>
                  <li>Register a test recipient number in Meta's developer panel before sending message dispatches.</li>
                </ol>
              </div>
            )}
            {/* Connection Scheduling section */}
            <div className="border-t border-slate-200 dark:border-slate-800 pt-4 mt-4 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Scheduled Heartbeat/Diagnostic Dispatch</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Cron expression" htmlFor="conn-cron" help="Standard 5-field cron: Min Hour Day Month Day-of-Week. Leave blank to disable.">
                  <Input
                    id="conn-cron"
                    value={form?.schedule_cron ?? ""}
                    onChange={(e) => setForm((f) => (f ? { ...f, schedule_cron: e.target.value } : f))}
                    placeholder="e.g. 0 * * * *"
                    className="font-mono text-xs"
                  />
                </Field>
                <Field label="Timezone" htmlFor="conn-tz" help="Timezone for evaluating schedule.">
                  <Select
                    id="conn-tz"
                    value={form?.schedule_tz ?? "UTC"}
                    onChange={(e) => setForm((f) => (f ? { ...f, schedule_tz: e.target.value } : f))}
                    className="text-xs"
                  >
                    <option value="UTC">UTC (GMT+00:00)</option>
                    <option value="Asia/Kolkata">Asia/Kolkata (IST, GMT+05:30)</option>
                    <option value="America/New_York">America/New_York (EST/EDT)</option>
                    <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                    <option value="America/Denver">America/Denver (MST/MDT)</option>
                    <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                    <option value="Europe/London">Europe/London (BST/GMT)</option>
                    <option value="Europe/Paris">Europe/Paris (CEST/CET)</option>
                    <option value="Asia/Singapore">Asia/Singapore (SGT, GMT+08:00)</option>
                    <option value="Asia/Tokyo">Asia/Tokyo (JST, GMT+09:00)</option>
                    <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                  </Select>
                </Field>
              </div>

              {form?.schedule_cron && (
                <Field label="Recipient for Scheduled Check" htmlFor="conn-to" help="The destination email address, phone number or chat ID.">
                  <Input
                    id="conn-to"
                    value={form?.schedule_to ?? ""}
                    onChange={(e) => setForm((f) => (f ? { ...f, schedule_to: e.target.value } : f))}
                    placeholder={recipientPlaceholder(form.type || "")}
                  />
                </Field>
              )}

              {form?.schedule_cron && (() => {
                try {
                  const c = new Cron(form.schedule_cron, { timezone: form.schedule_tz || "UTC" });
                  const nexts = c.nextRuns(5);
                  return (
                    <div className="rounded-xl bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 mt-2">
                      <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Next 5 scheduled runs</p>
                      <div className="space-y-1 font-mono text-[11px] text-slate-600 dark:text-slate-400">
                        {nexts.map((d, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="w-4 text-slate-300 dark:text-slate-600 font-bold">{idx + 1}.</span>
                            <span>{d.toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                } catch {
                  return (
                    <p className="text-xs text-red-600 dark:text-red-400 font-medium mt-1">Invalid cron expression</p>
                  );
                }
              })()}
            </div>
            <ErrorText>{error}</ErrorText>
          </form>
        )}
      </Modal>

      {/* Test modal */}
      <Modal
        open={testing !== null}
        onClose={() => setTesting(null)}
        title={`Send a test from "${testing?.name ?? ""}"`}
        description="Delivers a short test message so you can confirm the credentials work."
        size="sm"
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setTesting(null)}>Cancel</Button>
            <Button type="button" onClick={runTest} disabled={testBusy || !testTo}>{testBusy ? "Sending…" : "Send test"}</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); runTest(); }}>
          <Field
            label="Recipient"
            htmlFor="test-to"
            help={testing ? recipientHint(testing.type) : ""}
          >
            <Input id="test-to" value={testTo} onChange={(e) => setTestTo(e.target.value)} autoFocus placeholder={testing ? recipientPlaceholder(testing.type) : ""} />
          </Field>
          {testing?.type === "gmail" && (
            <div className="mt-3 flex items-center gap-2">
              <input
                type="checkbox"
                id="test-attach"
                checked={testAttach}
                onChange={(e) => setTestAttach(e.target.checked)}
                className="h-4 w-4 rounded border-slate-300 dark:border-slate-600 text-brand focus:ring-brand cursor-pointer"
              />
              <label htmlFor="test-attach" className="text-xs text-slate-600 dark:text-slate-400 font-medium cursor-pointer select-none">
                Include a test CSV attachment (test_report.csv)
              </label>
            </div>
          )}
        </form>
      </Modal>
    </div>
  );
}

function defaultName(type: string, conns: Connection[] | null) {
  const base = type;
  const taken = new Set((conns ?? []).map((c) => c.name));
  if (!taken.has(base)) return base;
  let i = 2;
  while (taken.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function recipientHint(type: string) {
  if (type === "telegram") return "A chat id or @channel your bot can post to.";
  if (type === "whatsapp") return "A phone number in international format, e.g. 919876543210.";
  return "An email address.";
}
function recipientPlaceholder(type: string) {
  if (type === "telegram") return "@my_channel";
  if (type === "whatsapp") return "919876543210";
  return "you@example.com";
}
