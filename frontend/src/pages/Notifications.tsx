import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../lib/api";
import type { Notification } from "../lib/types";
import { Button, Card, EmptyState, Spinner, cn, fmtDate } from "../components/ui";

export default function Notifications() {
  const navigate = useNavigate();
  const [items, setItems] = useState<Notification[] | null>(null);

  function load() { api.notifications.list().then(setItems).catch(() => setItems([])); }
  useEffect(() => { load(); }, []);

  async function open(n: Notification) {
    if (!n.is_read) { await api.notifications.markRead(n.id); }
    if (n.link) navigate(n.link); else load();
  }
  async function markAll() { await api.notifications.markAllRead(); load(); }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Notifications</h1>
          <p className="mt-1 text-sm text-zinc-500">Run results and workspace activity.</p>
        </div>
        <Button variant="subtle" onClick={markAll}>Mark all read</Button>
      </div>

      {!items ? (
        <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>
      ) : items.length === 0 ? (
        <EmptyState title="You're all caught up" hint="Notifications about your workflow runs will show up here." />
      ) : (
        <div className="space-y-2">
          {items.map((n) => (
            <Card
              key={n.id}
              className={cn("cursor-pointer p-4 transition-colors hover:border-zinc-700", !n.is_read && "border-l-2 border-l-emerald-500")}
              {...{ onClick: () => open(n) }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className={cn("text-sm", n.is_read ? "text-zinc-300" : "font-medium text-zinc-100")}>{n.title}</p>
                  <p className="mt-0.5 text-sm text-zinc-500">{n.message}</p>
                </div>
                <span className="shrink-0 text-xs text-zinc-600">{fmtDate(n.created_at)}</span>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
