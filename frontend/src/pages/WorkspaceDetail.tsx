import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ChevronLeft, Contact, FileCode2, KeyRound, Send, Settings, Users, Workflow,
} from "lucide-react";
import { api } from "../lib/api";
import type { Workspace } from "../lib/types";
import { Badge, PageHeader, Skeleton, Tabs } from "../components/ui";
import FilesTab from "./workspace/FilesTab";
import WorkflowsTab from "./workspace/WorkflowsTab";
import IntegrationsTab from "./workspace/IntegrationsTab";
import SecretsTab from "./workspace/SecretsTab";
import MembersTab from "./workspace/MembersTab";
import SettingsTab from "./workspace/SettingsTab";
import ContactsTab from "./workspace/ContactsTab";

const RANK: Record<string, number> = { viewer: 0, member: 1, maintainer: 2, owner: 3 };

const TABS = [
  { key: "files", label: "Files", icon: <FileCode2 className="h-4 w-4" /> },
  { key: "workflows", label: "Workflows", icon: <Workflow className="h-4 w-4" /> },
  { key: "contacts", label: "Contacts", icon: <Contact className="h-4 w-4" /> },
  { key: "integrations", label: "Integrations", icon: <Send className="h-4 w-4" /> },
  { key: "secrets", label: "Secrets", icon: <KeyRound className="h-4 w-4" /> },
  { key: "members", label: "Members", icon: <Users className="h-4 w-4" /> },
  { key: "settings", label: "Settings", icon: <Settings className="h-4 w-4" /> },
];

export default function WorkspaceDetail() {
  const { wsId = "" } = useParams();
  const [ws, setWs] = useState<Workspace | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("files");

  const load = useCallback(() => {
    api.workspaces.get(wsId).then(setWs).catch((e) => setError(e.message));
  }, [wsId]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-danger">{error}</p>;
  if (!ws) return (
    <div>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-4 h-8 w-64" />
      <Skeleton className="mt-6 h-10 w-full" />
    </div>
  );

  const rank = RANK[ws.role ?? "viewer"] ?? 0;
  const canWrite = rank >= RANK.member;
  const canManage = rank >= RANK.maintainer;
  const isOwner = rank >= RANK.owner;

  return (
    <div>
      <Link to="/workspaces" className="mb-3 inline-flex items-center gap-1 text-sm text-muted transition-colors hover:text-ink">
        <ChevronLeft className="h-4 w-4" /> Workspaces
      </Link>
      <PageHeader
        title={
          <span className="flex items-center gap-3">
            {ws.name}
            {ws.role && <Badge tone="brand" className="capitalize">{ws.role}</Badge>}
          </span>
        }
        description={<span className="font-mono text-xs">{ws.slug}</span>}
      />

      <Tabs tabs={TABS} active={tab} onChange={setTab} className="mb-6" />

      {tab === "files" && <FilesTab wsId={wsId} canWrite={canWrite} />}
      {tab === "workflows" && <WorkflowsTab wsId={wsId} canWrite={canWrite} />}
      {tab === "contacts" && <ContactsTab wsId={wsId} canManage={canManage} />}
      {tab === "integrations" && <IntegrationsTab wsId={wsId} canManage={canManage} />}
      {tab === "secrets" && <SecretsTab wsId={wsId} canManage={canManage} />}
      {tab === "members" && <MembersTab wsId={wsId} canManage={canManage} />}
      {tab === "settings" && <SettingsTab ws={ws} isOwner={isOwner} onUpdated={load} />}
    </div>
  );
}
