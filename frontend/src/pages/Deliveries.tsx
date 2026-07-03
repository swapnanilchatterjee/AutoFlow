import { Fragment, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ChevronDown, Clock, Download, FolderGit2, Info, Mail, MessageCircle, Paperclip,
  RefreshCw, ScrollText, Send, Terminal, Users,
} from "lucide-react";
import { api } from "../lib/api";
import type { Delivery } from "../lib/types";
import {
  Badge, Button, EmptyState, Input, PageHeader, Select, Skeleton, StatusPill, Table, TBody, TD, TH,
  THead, TR, cn, fmtDate,
} from "../components/ui";

const CHANNEL_ICON: Record<string, typeof Mail> = {
  gmail: Mail, telegram: Send, whatsapp: MessageCircle, shell: Terminal,
};
const CHANNEL_LABEL: Record<string, string> = {
  gmail: "Gmail", telegram: "Telegram", whatsapp: "WhatsApp", shell: "Shell",
};
const FORMAT_TONE: Record<string, "neutral" | "brand" | "info"> = {
  text: "neutral", html: "info", markdown: "brand",
};
const ACTIVE = "executing";

function splitDate(iso: string) {
  const tz = localStorage.getItem("af_timezone") || "local";
  const d = new Date(iso);
  if (tz === "utc") {
    return {
      day: d.toLocaleDateString("en-US", { timeZone: "UTC", month: "short", day: "numeric", year: "numeric" }),
      time: d.toLocaleTimeString("en-US", { timeZone: "UTC", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + " UTC",
    };
  }
  return {
    day: d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }),
    time: d.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit" }),
  };
}

export default function Deliveries() {
  const [rows, setRows] = useState<Delivery[] | null>(null);
  const [status, setStatus] = useState("");
  const [channel, setChannel] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setRows(null);
    try {
      const data = await api.deliveries.list({
        limit: 200,
        status: status || undefined,
        channel: channel || undefined,
      });
      setRows(data);
      if (timer.current) clearTimeout(timer.current);
      if (data.some((d) => d.status === ACTIVE)) {
        timer.current = setTimeout(() => load(true), 3000);
      }
    } catch { setRows([]); }
  }, [status, channel]);

  useEffect(() => {
    load();
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [load]);

  // Client-side date and recipient filtering
  const filteredRows = useMemo(() => {
    if (!rows) return [];
    return rows.filter((d) => {
      // 1. Search text filter (recipient or workflow name)
      const q = search.trim().toLowerCase();
      if (q) {
        const matchesSearch =
          d.recipients.some((r) => r.toLowerCase().includes(q)) ||
          d.workflow_name.toLowerCase().includes(q) ||
          (d.connection_name && d.connection_name.toLowerCase().includes(q));
        if (!matchesSearch) return false;
      }

      // 2. Date range filter
      const dt = new Date(d.created_at);
      if (startDateStr) {
        const start = new Date(startDateStr);
        start.setHours(0, 0, 0, 0);
        if (dt < start) return false;
      }
      if (endDateStr) {
        const end = new Date(endDateStr);
        end.setHours(23, 59, 59, 999);
        if (dt > end) return false;
      }

      return true;
    });
  }, [rows, search, startDateStr, endDateStr]);

  const handleExportCSV = () => {
    if (filteredRows.length === 0) return;
    const headers = ["ID", "When", "Workspace", "Workflow", "Channel", "Connection", "Recipients", "Status", "Detail"];
    const fileRows = filteredRows.map((d) => [
      d.id,
      d.created_at,
      d.workspace_slug || "",
      d.workflow_name,
      d.channel,
      d.connection_name || "",
      d.recipients.join("; "),
      d.status,
      d.detail || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...fileRows.map((r) => r.map((val) => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `autoflow_logs_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Logs"
        description="Track workflow executions and delivery logs — status, channels (WhatsApp/Email), recipients, and delivery details."
        actions={<Button variant="secondary" onClick={() => load()}><RefreshCw className="h-4 w-4" /> Refresh</Button>}
      />

      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-premium">
        <div className="w-full sm:w-48">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search recipient or workflow..."
            className="h-9 text-xs w-full"
          />
        </div>
        <div className="w-full sm:w-36">
          <Select value={status} onChange={(e) => setStatus(e.target.value)} className="h-9 text-xs w-full">
            <option value="">Status</option>
            <option value="delivered">Delivered</option>
            <option value="failed">Failed</option>
            <option value="executing">Executing</option>
          </Select>
        </div>
        <div className="w-full sm:w-36">
          <Select value={channel} onChange={(e) => setChannel(e.target.value)} className="h-9 text-xs w-full">
            <option value="">Channels</option>
            <option value="gmail">Gmail</option>
            <option value="telegram">Telegram</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="shell">Shell</option>
          </Select>
        </div>
        <div className="w-full sm:w-36">
          <Input
            type="date"
            value={startDateStr}
            onChange={(e) => setStartDateStr(e.target.value)}
            className="h-9 text-xs w-full"
          />
        </div>
        <div className="w-full sm:w-36">
          <Input
            type="date"
            value={endDateStr}
            onChange={(e) => setEndDateStr(e.target.value)}
            className="h-9 text-xs w-full"
          />
        </div>
        {(startDateStr || endDateStr || search) && (
          <button
            onClick={() => {
              setSearch("");
              setStartDateStr("");
              setEndDateStr("");
            }}
            className="text-xs text-brand hover:underline font-semibold select-none px-2 min-h-[44px]"
          >
            Clear filters
          </button>
        )}
        <Button
          size="sm"
          variant="secondary"
          onClick={handleExportCSV}
          disabled={filteredRows.length === 0}
          className="sm:ml-auto h-9 font-semibold inline-flex items-center justify-center w-full sm:w-auto"
        >
          <Download className="h-4 w-4" /> Export CSV
        </Button>
      </div>

      {!rows ? (
        <div className="space-y-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
      ) : filteredRows.length === 0 ? (
        <EmptyState
          icon={<ScrollText className="h-5 w-5" />}
          title="No logs found"
          description="Try adjusting your filters or date range parameters."
        />
      ) : (
        <div className="overflow-x-auto scroll-slim border border-slate-200 dark:border-slate-800 rounded-xl bg-white dark:bg-slate-900 shadow-premium">
          <Table className="min-w-[820px]">
            <THead>
              <TR>
                <TH>When</TH>
                <TH>Report</TH>
                <TH>Channel</TH>
                <TH>To</TH>
                <TH>Format</TH>
                <TH>Status</TH>
                <TH className="w-8" />
              </TR>
            </THead>
            <TBody>
              {filteredRows.map((d) => {
                const when = splitDate(d.created_at);
                const Icon = CHANNEL_ICON[d.channel] ?? Send;
                const open = expanded === d.id;
                const runHref = d.workflow_id && d.run_id
                  ? `/workspaces/${d.workspace_id}/workflows/${d.workflow_id}/runs/${d.run_id}`
                  : null;
                return (
                  <Fragment key={d.id}>
                    <TR onClick={() => setExpanded(open ? null : d.id)}>
                      <TD>
                        <div className="font-semibold text-slate-900 dark:text-white">{when.day}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 font-mono mt-0.5 tnum">{when.time}</div>
                      </TD>
                      <TD>
                        {runHref ? (
                          <Link to={runHref} onClick={(e) => e.stopPropagation()} className="font-semibold text-brand hover:underline">
                            {d.workflow_name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-900 dark:text-white">{d.workflow_name}</span>
                        )}
                        {d.run_number != null && <span className="ml-1.5 text-xs text-slate-500 dark:text-slate-400 font-mono tnum">#{d.run_number}</span>}
                        <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{d.step_name}</div>
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-300">
                          <Icon className="h-4 w-4 text-slate-500 dark:text-slate-400" />
                          {CHANNEL_LABEL[d.channel] ?? d.channel}
                        </span>
                      </TD>
                      <TD>
                        <span className="text-xs text-slate-600 dark:text-slate-400 font-mono">{d.recipients[0] ?? "—"}</span>
                        {d.recipient_count > 1 && (
                          <span className="ml-1.5 text-[10px] bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 px-1.5 py-0.2 rounded font-sans">
                            +{d.recipient_count - 1} more
                          </span>
                        )}
                        {d.attachment_count > 0 && (
                          <span className="ml-2.5 inline-flex items-center gap-0.5 text-xs text-slate-500 dark:text-slate-400 font-mono">
                            <Paperclip className="h-3.5 w-3.5" />{d.attachment_count}
                          </span>
                        )}
                      </TD>
                      <TD><Badge tone={FORMAT_TONE[d.body_format] ?? "neutral"}>{d.body_format}</Badge></TD>
                      <TD><StatusPill status={d.status} /></TD>
                      <TD><ChevronDown className={cn("h-4 w-4 text-slate-500 dark:text-slate-400 transition-transform", open && "rotate-180")} /></TD>
                    </TR>
                    {open && (
                      <tr className="animate-fade-in">
                        <td colSpan={7} className="p-0">
                          <div className="mx-5 mb-4 mt-1 rounded-2xl border bg-slate-50/80 p-5 shadow-sm dark:bg-slate-800/40 dark:border-slate-700/50">
                            <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
                              <Detail
                                icon={<Send className="h-4 w-4" />}
                                label="Connection"
                                value={d.connection_name || "\u2014"}
                              />
                              <Detail
                                icon={<FolderGit2 className="h-4 w-4" />}
                                label="Workspace"
                                value={d.workspace_slug || "\u2014"}
                                mono
                              />
                              <Detail
                                icon={<Users className="h-4 w-4" />}
                                label="Recipients"
                                value={d.recipients.join(", ") || "\u2014"}
                              />
                              <Detail
                                icon={<Mail className="h-4 w-4" />}
                                label="Subject"
                                value={d.subject || "\u2014"}
                              />
                              <Detail
                                icon={<Paperclip className="h-4 w-4" />}
                                label="Attachments"
                                value={String(d.attachment_count)}
                              />
                              <Detail
                                icon={<ScrollText className="h-4 w-4" />}
                                label="Provider refs"
                                value={d.provider_refs?.join(", ") || "\u2014"}
                                mono
                              />
                              <Detail
                                icon={<Clock className="h-4 w-4" />}
                                label="Started"
                                value={fmtDate(d.started_at)}
                              />
                              <Detail
                                icon={<Clock className="h-4 w-4" />}
                                label="Finished"
                                value={fmtDate(d.finished_at)}
                              />
                              <Detail
                                icon={<Info className="h-4 w-4" />}
                                label="Result"
                                value={d.detail || "\u2014"}
                                className={d.status === "failed" ? "text-red-600 dark:text-red-400 font-semibold" : "font-medium text-emerald-600 dark:text-emerald-400"}
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </TBody>
          </Table>
        </div>
      )}
    </div>
  );
}

function Detail({ icon, label, value, mono, className }: { icon?: ReactNode; label: string; value: string; mono?: boolean; className?: string }) {
  return (
    <div className="min-w-0">
      <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500">
        {icon && <span className="text-slate-400 dark:text-slate-500">{icon}</span>}
        {label}
      </dt>
      <dd className={cn("mt-1.5 break-words text-sm font-medium text-slate-800 dark:text-slate-200", mono && "font-mono text-xs", className)}>{value}</dd>
    </div>
  );
}
