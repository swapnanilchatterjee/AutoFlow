import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../lib/api";
import type { Workspace } from "../lib/types";
import { Badge, Spinner, cn } from "../components/ui";
import FilesTab from "./workspace/FilesTab";
import WorkflowsTab from "./workspace/WorkflowsTab";
import SecretsTab from "./workspace/SecretsTab";
import MembersTab from "./workspace/MembersTab";
import SettingsTab from "./workspace/SettingsTab";

const TABS = ["Files", "Workflows", "Secrets", "Members", "Settings"] as const;
type Tab = (typeof TABS)[number];

const RANK: Record<string, number> = { viewer: 0, member: 1, maintainer: 2, owner: 3 };

export default function WorkspaceDetail() {
  const { wsId = "" } = useParams();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("Files");

  const load = useCallback(() => {
    api.workspaces.get(wsId).then(setWs).catch((e) => setError(e.message));
  }, [wsId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-red-400">{error}</p>;
  if (!ws) return <div className="flex justify-center py-20"><Spinner className="h-6 w-6" /></div>;

  const rank = RANK[ws.role ?? "viewer"] ?? 0;
  const canWrite = rank >= RANK.member;
  const canManage = rank >= RANK.maintainer;
  const isOwner = rank >= RANK.owner;

  return (
    <div className="space-y-6">
      <div>
        <Link to="/workspaces" className="text-sm text-zinc-500 hover:text-zinc-300">← Workspaces</Link>
        <div className="mt-2 flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{ws.name}</h1>
          {ws.role && <Badge className="capitalize">{ws.role}</Badge>}
        </div>
        <p className="mt-1 font-mono text-xs text-zinc-500">{ws.slug}</p>
      </div>

      <div className="flex gap-1 border-b border-zinc-800">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "border-b-2 px-4 py-2.5 text-sm font-medium transition-colors",
              tab === t ? "border-emerald-500 text-zinc-100" : "border-transparent text-zinc-500 hover:text-zinc-300",
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <div>
        {tab === "Files" && <FilesTab wsId={wsId} canWrite={canWrite} />}
        {tab === "Workflows" && <WorkflowsTab wsId={wsId} canWrite={canWrite} />}
        {tab === "Secrets" && <SecretsTab wsId={wsId} canManage={canManage} />}
        {tab === "Members" && <MembersTab wsId={wsId} canManage={canManage} />}
        {tab === "Settings" && <SettingsTab ws={ws} isOwner={isOwner} onUpdated={load} />}
      </div>
    </div>
  );
}
