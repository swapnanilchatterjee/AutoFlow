import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { api } from "../../lib/api";
import type { TriggerType, Workflow } from "../../lib/types";
import { Badge, Button, Card, EmptyState, ErrorText, Input, Label, Modal, Spinner, StatusPill } from "../../components/ui";

const STARTER = `name: My Workflow
env:
  GREETING: hello
steps:
  - name: Say hello
    run: echo "$GREETING from AutoFlow"
  - name: Build
    run: |
      echo "building..."
      echo done
`;

export default function WorkflowsTab({ wsId, canWrite }: { wsId: string; canWrite: boolean }) {
  const navigate = useNavigate();
  const [items, setItems] = useState<Workflow[] | null>(null);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<TriggerType>("manual");
  const [cron, setCron] = useState("0 * * * *");
  const [tz, setTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC");
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
        schedule_tz: trigger === "schedule" ? tz : undefined,
      });
      setOpen(false); setName("");
      navigate(`/workspaces/${wsId}/workflows/${wf.id}`);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-zinc-500">Automations that run a sequence of shell steps.</p>
        {canWrite && <Button onClick={() => setOpen(true)}>New workflow</Button>}
      </div>

      {!items ? (
        <div className="flex justify-center py-16"><Spinner className="h-6 w-6" /></div>
      ) : items.length === 0 ? (
        <EmptyState
          title="No workflows yet"
          hint="Create a workflow to automate builds, jobs and scheduled tasks."
          action={canWrite ? <Button onClick={() => setOpen(true)}>New workflow</Button> : undefined}
        />
      ) : (
        <div className="space-y-2">
          {items.map((wf) => (
            <Link
              key={wf.id}
              to={`/workspaces/${wsId}/workflows/${wf.id}`}
              className="block hover:no-underline"
            >
              <Card className="flex cursor-pointer items-center justify-between p-4 transition-colors hover:border-zinc-700">
                <div className="flex items-center gap-3">
                  <div>
                    <p className="font-medium text-zinc-100">{wf.name}</p>
                    <p className="font-mono text-xs text-zinc-500">{wf.slug}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Badge>{wf.trigger_type}</Badge>
                  {!wf.enabled && <StatusPill status="cancelled" />}
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}

      <Modal open={open} onClose={() => setOpen(false)} title="New workflow">
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <div><Label>Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} autoFocus placeholder="My Workflow" /></div>
          <div>
            <Label>Trigger</Label>
            <div className="flex gap-2">
              {(["manual", "schedule", "webhook"] as TriggerType[]).map((t) => (
                <button key={t} type="button" onClick={() => setTrigger(t)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm capitalize ${trigger === t ? "border-emerald-500 bg-emerald-500/10 text-emerald-400" : "border-zinc-700 text-zinc-400 hover:border-zinc-600"}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
          {trigger === "schedule" && (
            <>
              <div><Label>Cron schedule</Label><Input value={cron} onChange={(e) => setCron(e.target.value)} className="font-mono" placeholder="0 * * * *" /></div>
              <div>
                <Label>Timezone</Label>
                <select
                  value={tz}
                  onChange={(e) => setTz(e.target.value)}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                >
                  <option value="UTC">UTC</option>
                  <option value={Intl.DateTimeFormat().resolvedOptions().timeZone}>{Intl.DateTimeFormat().resolvedOptions().timeZone} (Local)</option>
                  <option value="America/New_York">America/New_York (EST/EDT)</option>
                  <option value="America/Chicago">America/Chicago (CST/CDT)</option>
                  <option value="America/Denver">America/Denver (MST/MDT)</option>
                  <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
                  <option value="Europe/London">Europe/London (GMT/BST)</option>
                  <option value="Europe/Paris">Europe/Paris (CET/CEST)</option>
                  <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                  <option value="Asia/Tokyo">Asia/Tokyo (JST)</option>
                  <option value="Australia/Sydney">Australia/Sydney (AEST/AEDT)</option>
                </select>
              </div>
            </>
          )}
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
