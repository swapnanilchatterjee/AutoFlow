import { useEffect, useMemo, useState } from "react";
import {
  Calendar, CheckCircle2, Download, Mail, MessageCircle, Play,
  Send, TrendingUp, XCircle
} from "lucide-react";
import { api } from "../lib/api";
import type { DashboardStats, Delivery } from "../lib/types";
import {
  Button, Card, CardBody, CardHeader, EmptyState, Input, PageHeader,
  Skeleton, StatCard, StatusPill, Table, TBody, TD, TH, THead, TR, cn, useToast,
} from "../components/ui";

const CHANNEL_ICON: Record<string, typeof Mail> = {
  gmail: Mail, telegram: Send, whatsapp: MessageCircle,
};

type Granularity = "sec" | "min" | "hour" | "day" | "month";

export default function Dashboard() {
  const toast = useToast();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [deliveries, setDeliveries] = useState<Delivery[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Granularity selector for the line graph
  const [granularity, setGranularity] = useState<Granularity>("day");
  const [chartView, setChartView] = useState<"all" | "success" | "failed" | "executing">("all");

  // Date range state (default to past 7 days)
  const [startDateStr, setStartDateStr] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split("T")[0];
  });
  const [endDateStr, setEndDateStr] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  useEffect(() => {
    api.dashboard.stats().then(setStats).catch((e) => setError(e.message));
    api.deliveries.list({ limit: 1000 }).then(setDeliveries).catch(() => setDeliveries([]));
  }, []);

  // Filter deliveries by selected date range
  const filteredDeliveries = useMemo(() => {
    if (!deliveries) return [];
    const start = new Date(startDateStr);
    start.setHours(0, 0, 0, 0);
    const end = new Date(endDateStr);
    end.setHours(23, 59, 59, 999);

    return deliveries.filter((d) => {
      const dt = new Date(d.created_at);
      return dt >= start && dt <= end;
    });
  }, [deliveries, startDateStr, endDateStr]);

  // Compute stats based on the filtered deliveries
  const computedStats = useMemo(() => {
    const total = filteredDeliveries.length;
    const success = filteredDeliveries.filter((d) => d.status === "delivered").length;
    const failed = filteredDeliveries.filter((d) => d.status === "failed").length;
    const rate = total > 0 ? Math.round((success / total) * 100) : 100;

    const channelBreakdown = filteredDeliveries.reduce((acc, d) => {
      acc[d.channel] = (acc[d.channel] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return { total, success, failed, rate, channelBreakdown };
  }, [filteredDeliveries]);

  // Line Chart Data Aggregation
  const chartData = useMemo(() => {
    if (filteredDeliveries.length === 0) {
      return { points: [], maxVal: 1 };
    }

    const groupMap = new Map<string, { label: string; success: number; failed: number; executing: number; sortKey: string }>();

    filteredDeliveries.forEach((d) => {
      const dt = new Date(d.created_at);
      let key = "";
      let label = "";

      if (granularity === "sec") {
        // Round to nearest second
        const secStr = dt.toISOString().split(".")[0]; // YYYY-MM-DDTHH:MM:SS
        key = secStr;
        label = secStr.split("T")[1]; // HH:MM:SS
      } else if (granularity === "min") {
        const minStr = dt.toISOString().substring(0, 16); // YYYY-MM-DDTHH:MM
        key = minStr;
        label = minStr.split("T")[1]; // HH:MM
      } else if (granularity === "hour") {
        const hrStr = dt.toISOString().substring(0, 13); // YYYY-MM-DDTHH
        key = hrStr;
        label = hrStr.split("T")[1] + ":00"; // HH:00
      } else if (granularity === "day") {
        const dayStr = dt.toISOString().split("T")[0]; // YYYY-MM-DD
        key = dayStr;
        label = dt.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      } else if (granularity === "month") {
        const monthStr = dt.toISOString().substring(0, 7); // YYYY-MM
        key = monthStr;
        label = dt.toLocaleDateString(undefined, { month: "short", year: "numeric" });
      }

      const existing = groupMap.get(key);
      if (existing) {
        if (d.status === "delivered") existing.success += 1;
        else if (d.status === "failed") existing.failed += 1;
        else existing.executing += 1;
      } else {
        groupMap.set(key, {
          label,
          success: d.status === "delivered" ? 1 : 0,
          failed: d.status === "failed" ? 1 : 0,
          executing: (d.status !== "delivered" && d.status !== "failed") ? 1 : 0,
          sortKey: key,
        });
      }
    });

    // Sort chronologically
    const sortedEntries = Array.from(groupMap.values()).sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    if (sortedEntries.length === 1) {
      // Add a 0-value prefix point so we have 2 points for the line graph to render
      sortedEntries.unshift({
        label: "Start",
        success: 0,
        failed: 0,
        executing: 0,
        sortKey: "0_start"
      });
    }
    const maxVal = Math.max(1, ...sortedEntries.map((e) => e.success + e.failed + e.executing));

    return { points: sortedEntries, maxVal };
  }, [filteredDeliveries, granularity]);

  const handleExportCSV = () => {
    if (filteredDeliveries.length === 0) {
      toast.error("No data available to export in this range.");
      return;
    }

    const headers = ["ID", "When", "Workspace", "Workflow", "Channel", "Connection", "Recipients", "Status", "Detail"];
    const csvRows = filteredDeliveries.map((d) => [
      d.id,
      d.created_at,
      d.workspace_slug || "",
      d.workflow_name,
      d.channel,
      d.connection_name,
      d.recipients.join("; "),
      d.status,
      d.detail || "",
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers.join(","), ...csvRows.map((r) => r.map((val) => `"${val.replace(/"/g, '""')}"`).join(","))].join("\n");

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `autoflow_logs_${startDateStr}_to_${endDateStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV Export downloaded successfully");
  };

  // Generate SVG coordinates for Line Graph
  const svgDimensions = { width: 500, height: 180 };
  const padding = { left: 40, right: 20, top: 15, bottom: 25 };

  const svgPaths = useMemo(() => {
    const { points, maxVal } = chartData;
    if (points.length < 2) return null;

    const w = svgDimensions.width - padding.left - padding.right;
    const h = svgDimensions.height - padding.top - padding.bottom;

    const successCoords = points.map((p, idx) => ({
      x: padding.left + (idx / (points.length - 1)) * w,
      y: svgDimensions.height - padding.bottom - (p.success / maxVal) * h,
    }));

    const failedCoords = points.map((p, idx) => ({
      x: padding.left + (idx / (points.length - 1)) * w,
      y: svgDimensions.height - padding.bottom - (p.failed / maxVal) * h,
    }));

    const executingCoords = points.map((p, idx) => ({
      x: padding.left + (idx / (points.length - 1)) * w,
      y: svgDimensions.height - padding.bottom - (p.executing / maxVal) * h,
    }));

    const makePath = (coords: { x: number; y: number }[]) =>
      coords.reduce((acc, c, idx) => acc + (idx === 0 ? `M ${c.x} ${c.y}` : ` L ${c.x} ${c.y}`), "");

    const successPath = makePath(successCoords);
    const failedPath = makePath(failedCoords);
    const executingPath = makePath(executingCoords);

    return {
      successPath,
      failedPath,
      executingPath,
      points: points.map((p, idx) => ({
        x: padding.left + (idx / (points.length - 1)) * w,
        y: svgDimensions.height - padding.bottom - (Math.max(p.success, p.failed, p.executing) / maxVal) * h,
        label: p.label,
        success: p.success,
        failed: p.failed,
        executing: p.executing,
      })),
    };
  }, [chartData]);

  if (error) return <p className="text-danger">{error}</p>;

  if (!stats || !deliveries) {
    return (
      <div className="space-y-6">
        <PageHeader title="Dashboard" description="Activity across all your workspaces." />
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-[92px]" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader title="Dashboard" description="Activity across all your workspaces." />
        
        {/* Date Range Picker Controls */}
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-100 bg-white p-3 shadow-premium">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wide">
            <Calendar className="h-4 w-4 text-brand" /> Range:
          </div>
          <div className="w-36">
            <Input
              type="date"
              value={startDateStr}
              onChange={(e) => setStartDateStr(e.target.value)}
              className="h-8 text-xs py-1"
            />
          </div>
          <span className="text-slate-300 font-bold">—</span>
          <div className="w-36">
            <Input
              type="date"
              value={endDateStr}
              onChange={(e) => setEndDateStr(e.target.value)}
              className="h-8 text-xs py-1"
            />
          </div>
          <Button
            size="sm"
            variant="secondary"
            onClick={handleExportCSV}
            className="h-8 inline-flex items-center justify-center font-semibold"
          >
            <Download className="h-4 w-4" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Filtered Metrics Grid */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard
          label="Filtered runs"
          value={computedStats.total}
          icon={<Play className="h-[18px] w-[18px]" />}
          hint={`From ${startDateStr} to ${endDateStr}`}
        />
        <StatCard
          label="Delivered"
          value={computedStats.success}
          icon={<CheckCircle2 className="h-[18px] w-[18px] text-ok" />}
          hint="Successful deliveries"
        />
        <StatCard
          label="Failed"
          value={computedStats.failed}
          icon={<XCircle className="h-[18px] w-[18px] text-danger" />}
          hint="Rejected deliveries"
        />
        <StatCard
          label="Success rate"
          value={`${computedStats.rate}%`}
          icon={<TrendingUp className="h-[18px] w-[18px]" />}
          hint="Within filtered range"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Trend Line Chart Card */}
        <Card className="lg:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-100 px-5 py-4">
            <div>
              <h3 className="text-sm font-bold text-slate-800">Execution logs trend</h3>
              <p className="text-xs text-slate-400">Timeline graph showing delivered, executing and failed runs.</p>
            </div>
            
            {/* Chart Legend */}
            <div className="flex items-center gap-3.5 text-[10px] font-semibold text-slate-500 select-none">
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Delivered
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-amber-500" />
                Executing
              </span>
              <span className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-full bg-rose-500" />
                Failed
              </span>
            </div>
            
            {/* Controls: view selector & granularity */}
            <div className="flex items-center gap-3">
              {/* Dropdown for Status Filter */}
              <select
                value={chartView}
                onChange={(e) => setChartView(e.target.value as any)}
                className="h-7 rounded border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-bold text-slate-700 outline-none hover:border-slate-300 transition-colors"
              >
                <option value="all">Show All Lines</option>
                <option value="success">Delivered Only</option>
                <option value="failed">Failed Only</option>
                <option value="executing">Executing Only</option>
              </select>

              {/* Granularity Selector Toggles */}
              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-0.5 border border-slate-200/20">
                {(["sec", "min", "hour", "day", "month"] as const).map((g) => (
                  <button
                    key={g}
                    onClick={() => setGranularity(g)}
                    className={cn(
                      "rounded px-2 py-0.5 text-[10px] font-bold capitalize transition-all select-none",
                      granularity === g
                        ? "bg-white text-slate-800 shadow-sm"
                        : "text-slate-500 hover:text-slate-700",
                    )}
                  >
                    {g}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <CardBody className="pt-6">
            {chartData.points.length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-16">No daily stats for this range.</p>
            ) : chartData.points.length === 1 ? (
              <div className="flex h-48 flex-col items-center justify-center text-center">
                <p className="text-sm font-semibold text-slate-800">1 Datapoint Collected</p>
                <p className="text-xs text-slate-400 mt-1">Total: {chartData.points[0].success + chartData.points[0].failed} dispatches ({chartData.points[0].label})</p>
              </div>
            ) : svgPaths ? (
              <div className="relative w-full h-52">
                <svg
                  viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
                  className="w-full h-full text-brand overflow-visible"
                >
                  <defs>
                    <linearGradient id="chart-area-grad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
                      <stop offset="100%" stopColor="currentColor" stopOpacity="0.00" />
                    </linearGradient>
                  </defs>

                  {/* Horizontal gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((r, i) => {
                    const y = padding.top + r * (svgDimensions.height - padding.top - padding.bottom);
                    const val = Math.round(chartData.maxVal * (1 - r));
                    return (
                      <g key={i} className="opacity-40">
                        <line
                          x1={padding.left}
                          y1={y}
                          x2={svgDimensions.width - padding.right}
                          y2={y}
                          stroke="#e2e8f0"
                          strokeDasharray="2 3"
                        />
                        <text
                          x={padding.left - 8}
                          y={y + 3}
                          textAnchor="end"
                          className="font-mono text-[9px] fill-slate-400 font-bold"
                        >
                          {val}
                        </text>
                      </g>
                    );
                  })}

                  {/* Line strokes for each status */}
                  {svgPaths.successPath && (chartView === "all" || chartView === "success") && (
                    <path
                      d={svgPaths.successPath}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                  {svgPaths.executingPath && (chartView === "all" || chartView === "executing") && (
                    <path
                      d={svgPaths.executingPath}
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeDasharray="4 3"
                    />
                  )}
                  {svgPaths.failedPath && (chartView === "all" || chartView === "failed") && (
                    <path
                      d={svgPaths.failedPath}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Vertical interaction guide lines and tooltips */}
                  {svgPaths.points.map((pt, idx) => (
                    <g key={idx} className="group/guide cursor-pointer">
                      {/* Invisible wider interaction zone */}
                      <line
                        x1={pt.x}
                        y1={padding.top}
                        x2={pt.x}
                        y2={svgDimensions.height - padding.bottom}
                        stroke="transparent"
                        strokeWidth="24"
                      />
                      {/* Visible dashed guide line on hover */}
                      <line
                        x1={pt.x}
                        y1={padding.top}
                        x2={pt.x}
                        y2={svgDimensions.height - padding.bottom}
                        stroke="#cbd5e1"
                        strokeDasharray="2 2"
                        className="opacity-0 group-hover/guide:opacity-100 transition-opacity pointer-events-none"
                      />
                      {/* Hover tooltip */}
                      <g className="opacity-0 group-hover/guide:opacity-100 transition-opacity duration-150 pointer-events-none z-30">
                        <rect
                          x={pt.x - 55}
                          y={padding.top}
                          width="110"
                          height="56"
                          rx="5"
                          fill="#1e293b"
                          className="shadow-premium"
                        />
                        <text x={pt.x} y={padding.top + 12} textAnchor="middle" className="text-[9px] fill-slate-300 font-bold font-sans">
                          {pt.label}
                        </text>
                        <text x={pt.x} y={padding.top + 23} textAnchor="middle" className="text-[9px] fill-emerald-400 font-bold font-sans">
                          Delivered: {pt.success}
                        </text>
                        <text x={pt.x} y={padding.top + 34} textAnchor="middle" className="text-[9px] fill-rose-400 font-bold font-sans">
                          Failed: {pt.failed}
                        </text>
                        <text x={pt.x} y={padding.top + 45} textAnchor="middle" className="text-[9px] fill-amber-400 font-bold font-sans">
                          Executing: {pt.executing}
                        </text>
                      </g>

                      {/* X Axis Labels */}
                      {idx % Math.max(1, Math.round(svgPaths.points.length / 6)) === 0 && (
                        <text
                          x={pt.x}
                          y={svgDimensions.height - 8}
                          textAnchor="middle"
                          className="text-[9px] font-semibold fill-slate-400 font-sans"
                        >
                          {pt.label}
                        </text>
                      )}
                    </g>
                  ))}
                </svg>
              </div>
            ) : null}
          </CardBody>
        </Card>

        {/* Channels Breakdown */}
        <Card className="lg:col-span-1">
          <CardHeader title="Deliveries by channel" description="Usage across Gmail, Telegram, WhatsApp." />
          <CardBody className="space-y-5 pt-5">
            {Object.keys(computedStats.channelBreakdown).length === 0 ? (
              <p className="text-center text-sm text-slate-400 py-16">No channels used in this range.</p>
            ) : (
              Object.entries(computedStats.channelBreakdown).map(([ch, count]) => {
                const percent = computedStats.total > 0 ? Math.round((count / computedStats.total) * 100) : 0;
                const Icon = CHANNEL_ICON[ch] ?? Send;
                return (
                  <div key={ch} className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span className="flex items-center gap-1.5 capitalize">
                        <Icon className="h-4 w-4 text-slate-400" />
                        {ch}
                      </span>
                      <span>{count} ({percent}%)</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                      <div
                        style={{ width: `${percent}%` }}
                        className={cn(
                          "h-full rounded-full bg-gradient-to-r",
                          ch === "gmail" && "from-danger-500 to-red-400",
                          ch === "whatsapp" && "from-emerald-500 to-teal-400",
                          ch === "telegram" && "from-info-500 to-sky-400",
                        )}
                      />
                    </div>
                  </div>
                );
              })
            )}
          </CardBody>
        </Card>
      </div>

      {/* Date-Range Filtered Deliveries Table Details */}
      <Card>
        <CardHeader title="Execution details log" description="Detailed recipient logs in the selected date range." />
        {filteredDeliveries.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Calendar className="h-5 w-5" />}
              title="No deliveries found"
              description="No workflow dispatches match the selected date range."
            />
          </div>
        ) : (
          <div className="overflow-x-auto scroll-slim">
            <Table className="min-w-[700px]">
              <THead>
                <TR>
                  <TH>When</TH>
                  <TH>Report / Workflow</TH>
                  <TH>Channel</TH>
                  <TH>Recipient</TH>
                  <TH>Status</TH>
                </TR>
              </THead>
              <TBody>
                {filteredDeliveries.map((d) => {
                  const dt = new Date(d.created_at);
                  const formattedDate = dt.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
                  const formattedTime = dt.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                  const Icon = CHANNEL_ICON[d.channel] ?? Send;

                  return (
                    <TR key={d.id}>
                      <TD>
                        <div className="font-semibold text-slate-800">{formattedDate}</div>
                        <div className="text-[11px] text-slate-400 font-mono mt-0.5">{formattedTime}</div>
                      </TD>
                      <TD>
                        <span className="font-semibold text-slate-700">{d.workflow_name}</span>
                        {d.workspace_slug && (
                          <span className="ml-2 font-mono text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded">
                            {d.workspace_slug}
                          </span>
                        )}
                        <div className="text-xs text-slate-400 mt-0.5">{d.step_name}</div>
                      </TD>
                      <TD>
                        <span className="inline-flex items-center gap-1.5 text-xs text-slate-600 font-medium">
                          <Icon className="h-3.5 w-3.5 text-slate-400" />
                          {d.channel}
                        </span>
                      </TD>
                      <TD>
                        <span className="text-xs text-slate-600 font-mono">{d.recipients[0] || "—"}</span>
                        {d.recipient_count > 1 && (
                          <span className="ml-1 text-[10px] bg-slate-100 text-slate-400 px-1.5 py-0.2 rounded font-sans">
                            +{d.recipient_count - 1} more
                          </span>
                        )}
                      </TD>
                      <TD><StatusPill status={d.status} /></TD>
                    </TR>
                  );
                })}
              </TBody>
            </Table>
          </div>
        )}
      </Card>
    </div>
  );
}
