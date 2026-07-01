import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Bell, CheckCheck, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";
import type { Notification } from "../lib/types";
import { Button, Card, EmptyState, PageHeader, Skeleton, cn, fmtRelative, useToast } from "../components/ui";

export default function Notifications() {
  const navigate = useNavigate();
  const toast = useToast();
  const [items, setItems] = useState<Notification[] | null>(null);

  function load() { api.notifications.list().then(setItems).catch(() => setItems([])); }
  useEffect(() => { load(); }, []);

  async function open(n: Notification) {
    if (!n.is_read) { await api.notifications.markRead(n.id); }
    if (n.link) navigate(n.link); else load();
  }
  async function markAll() { await api.notifications.markAllRead(); toast.success("All notifications marked read"); load(); }

  const hasUnread = items?.some((n) => !n.is_read);

  return (
    <div>
      <PageHeader
        title="Notifications"
        description="Run results and workspace activity."
        actions={
          <Button variant="secondary" onClick={markAll} disabled={!hasUnread}>
            <CheckCheck className="h-4 w-4" /> Mark all read
          </Button>
        }
      />

      {!items ? (
        <div className="space-y-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-16" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Bell className="h-5 w-5" />}
          title="You're all caught up"
          description="Notifications about your workflow runs will show up here."
        />
      ) : (
        <div className="space-y-2">
          {items.map((n) => {
            const failed = n.type === "error";
            return (
              <Card
                key={n.id}
                className={cn(
                  "flex cursor-pointer items-start gap-3 p-4 transition-shadow hover:shadow-pop",
                  !n.is_read && "ring-1 ring-brand-100",
                )}
                {...{ onClick: () => open(n) }}
              >
                <span className={cn(
                  "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                  failed ? "bg-danger-50 text-danger" : "bg-ok-50 text-ok",
                )}>
                  {failed ? <AlertCircle className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm", n.is_read ? "text-muted" : "font-medium text-ink")}>{n.title}</p>
                  {n.message && <p className="mt-0.5 text-sm text-muted">{n.message}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className="text-xs text-faint">{fmtRelative(n.created_at)}</span>
                  {!n.is_read && <span className="h-2 w-2 rounded-full bg-brand" />}
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
