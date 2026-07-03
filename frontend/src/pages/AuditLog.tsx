import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Filter, RefreshCw, Search } from "lucide-react";
import { api } from "../lib/api";
import type { AdminActivityLog, PaginatedResponse } from "../lib/types";
import {
  Badge, Button, Card, CardBody, Field, Input, PageHeader, Select, Spinner, useToast,
} from "../components/ui";

const ACTION_OPTIONS = [
  { label: "All actions", value: "" },
  { label: "Created", value: "created" },
  { label: "Updated", value: "updated" },
  { label: "Deleted", value: "deleted" },
  { label: "Triggered", value: "triggered" },
  { label: "Commented", value: "commented" },
  { label: "Shared", value: "shared" },
  { label: "Transferred", value: "transferred" },
  { label: "Login", value: "login" },
];

const ENTITY_OPTIONS = [
  { label: "All types", value: "" },
  { label: "Workflow", value: "workflow" },
  { label: "Workflow Run", value: "workflow_run" },
  { label: "Connection", value: "connection" },
  { label: "Secret", value: "secret" },
  { label: "Variable", value: "variable" },
  { label: "User", value: "user" },
  { label: "Workspace", value: "workspace" },
];

function fmtDateTime(iso: string | null) {
  if (!iso) return "\u2014";
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function actionBadgeTone(action: string) {
  switch (action) {
    case "created": return "ok" as const;
    case "deleted": return "danger" as const;
    case "updated":
    case "transferred":
    case "shared": return "brand" as const;
    default: return "neutral" as const;
  }
}

export default function AuditLog() {
  const toast = useToast();
  const [data, setData] = useState<PaginatedResponse<AdminActivityLog> | null>(null);
  const [loading, setLoading] = useState(true);
  const [limit] = useState(50);
  const [offset, setOffset] = useState(0);
  const [action, setAction] = useState("");
  const [entityType, setEntityType] = useState("");
  const [userSearch, setUserSearch] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const result = await api.admin.activity({
        limit,
        offset,
        action: action || undefined,
        entity_type: entityType || undefined,
        user_search: userSearch || undefined,
      });
      setData(result);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load activity logs");
    } finally {
      setLoading(false);
    }
  }, [limit, offset, action, entityType, userSearch, toast]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const currentPage = Math.floor(offset / limit) + 1;

  return (
    <div>
      <PageHeader
        title="Audit Log"
        description="Global activity log across all workspaces and users."
        actions={
          <Button variant="secondary" onClick={fetchLogs} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
          </Button>
        }
      />

      <Card className="mb-6">
        <CardBody>
          <div className="flex flex-wrap items-end gap-4">
            <div className="min-w-[180px] flex-1">
              <Field label="User">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={userSearch}
                    onChange={(e) => { setUserSearch(e.target.value); setOffset(0); }}
                    placeholder="Search by name or email"
                    className="pl-9"
                  />
                </div>
              </Field>
            </div>
            <div className="min-w-[160px]">
              <Field label="Action">
                <Select value={action} onChange={(e) => { setAction(e.target.value); setOffset(0); }}>
                  {ACTION_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="min-w-[160px]">
              <Field label="Entity Type">
                <Select value={entityType} onChange={(e) => { setEntityType(e.target.value); setOffset(0); }}>
                  {ENTITY_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </Select>
              </Field>
            </div>
            <Button variant="ghost" onClick={() => { setAction(""); setEntityType(""); setUserSearch(""); setOffset(0); }}>
              <Filter className="h-4 w-4" /> Clear
            </Button>
          </div>
        </CardBody>
      </Card>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b bg-slate-50/80 dark:bg-slate-800/50 dark:border-slate-800">
                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Timestamp</th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">User</th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Action</th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Entity Type</th>
                <th className="px-5 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading && !data ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center">
                    <Spinner className="mx-auto h-6 w-6" />
                  </td>
                </tr>
              ) : data && data.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-5 py-12 text-center text-sm text-slate-400 dark:text-slate-500">
                    No activity logs found.
                  </td>
                </tr>
              ) : data ? (
                data.items.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="px-5 py-3.5 text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap font-mono">
                      {fmtDateTime(log.created_at)}
                    </td>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                          {(log.user?.full_name || log.user?.username || "?").charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <span className="block text-sm font-semibold text-slate-800 dark:text-slate-200">
                            {log.user?.full_name || log.user?.username || "Unknown"}
                          </span>
                          <span className="block text-[11px] text-slate-400 dark:text-slate-500">
                            @{log.user?.username || "?"}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge tone={actionBadgeTone(log.action)}>{log.action}</Badge>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-medium text-slate-700 dark:text-slate-300 capitalize">
                        {log.entity_type.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 max-w-xs">
                      <p className="text-sm text-slate-600 dark:text-slate-400 truncate">
                        {log.details || "\u2014"}
                      </p>
                    </td>
                  </tr>
                ))
              ) : null}
            </tbody>
          </table>
        </div>

        {data && data.total > limit && (
          <div className="flex items-center justify-between border-t px-5 py-3.5 dark:border-slate-800">
            <span className="text-xs text-slate-400 dark:text-slate-500">
              Showing {offset + 1}\u2013{Math.min(offset + limit, data.total)} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                disabled={offset === 0}
                onClick={() => setOffset((o) => Math.max(0, o - limit))}
              >
                <ChevronLeft className="h-4 w-4" /> Previous
              </Button>
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tnum">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                size="sm"
                variant="ghost"
                disabled={offset + limit >= data.total}
                onClick={() => setOffset((o) => o + limit)}
              >
                Next <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
