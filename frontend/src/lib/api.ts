import type {
  BranchInfo, ChannelCatalogItem, CommitInfo, Connection, ConnectionTestResult,
  DashboardStats, Delivery, DirListing, FileContent, FileNode, GitStatus, Member,
  Notification, RecentRun, Secret, Tokens, User, Variable, Workflow, WorkflowRun, Workspace,
  WorkflowComment, WorkflowShare, ActivityLog, AdminStats, WorkerInfo,
} from "./types";


const BASE = "/api/v1";
const ACCESS = "af_access";
const REFRESH = "af_refresh";

export const tokenStore = {
  get access() {
    return localStorage.getItem(ACCESS) || sessionStorage.getItem(ACCESS);
  },
  get refresh() {
    return localStorage.getItem(REFRESH) || sessionStorage.getItem(REFRESH);
  },
  set(t: Tokens, remember = true) {
    if (remember) {
      localStorage.setItem("af_remember", "true");
      localStorage.setItem(ACCESS, t.access_token);
      localStorage.setItem(REFRESH, t.refresh_token);
      sessionStorage.removeItem(ACCESS);
      sessionStorage.removeItem(REFRESH);
    } else {
      localStorage.setItem("af_remember", "false");
      sessionStorage.setItem(ACCESS, t.access_token);
      sessionStorage.setItem(REFRESH, t.refresh_token);
      localStorage.removeItem(ACCESS);
      localStorage.removeItem(REFRESH);
    }
  },
  clear() {
    localStorage.removeItem(ACCESS);
    localStorage.removeItem(REFRESH);
    localStorage.removeItem("af_remember");
    sessionStorage.removeItem(ACCESS);
    sessionStorage.removeItem(REFRESH);
  },
};


export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

let refreshing: Promise<boolean> | null = null;

async function tryRefresh(): Promise<boolean> {
  const rt = tokenStore.refresh;
  if (!rt) return false;
  if (!refreshing) {
    refreshing = fetch(`${BASE}/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: rt }),
    }).then(async (r) => {
      if (!r.ok) { tokenStore.clear(); return false; }
      tokenStore.set(await r.json());
      return true;
    }).catch(() => false).finally(() => { refreshing = null; });
  }
  return refreshing;
}

type AuthHandler = () => void;
let onAuthFailure: AuthHandler | null = null;

export const authEvents = {
  setHandler(handler: AuthHandler) { onAuthFailure = handler; },
  trigger() { if (onAuthFailure) onAuthFailure(); }
};

interface Opts { method?: string; body?: unknown; form?: URLSearchParams; raw?: boolean; }

async function request<T>(path: string, opts: Opts = {}, retry = true): Promise<T> {
  const headers: Record<string, string> = {};
  const access = tokenStore.access;
  if (access) headers["Authorization"] = `Bearer ${access}`;
  let body: BodyInit | undefined;
  if (opts.form) { body = opts.form; }
  else if (opts.body instanceof FormData) { body = opts.body; }
  else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  const res = await fetch(`${BASE}${path}`, { method: opts.method ?? "GET", headers, body });
  if (res.status === 401) {
    if (retry && (await tryRefresh())) {
      return request<T>(path, opts, false);
    }
    tokenStore.clear();
    authEvents.trigger();
  }
  if (!res.ok) {
    let detail = `${res.status} ${res.statusText}`;
    try { const j = await res.json(); detail = j.detail || j.error || detail; } catch { /* ignore */ }
    throw new ApiError(res.status, detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

const qs = (params: Record<string, string | number | boolean | undefined>) => {
  const u = new URLSearchParams();
  Object.entries(params).forEach(([k, v]) => { if (v !== undefined) u.set(k, String(v)); });
  const s = u.toString();
  return s ? `?${s}` : "";
};

export const api = {
  auth: {
    async login(username: string, password: string, remember = true): Promise<Tokens> {
      const form = new URLSearchParams({ username, password });
      const t = await request<Tokens>("/auth/login", { method: "POST", form });
      tokenStore.set(t, remember);
      return t;
    },
    register: (body: { email: string; username: string; password: string; full_name?: string; admin_token?: string }) =>
      request<User>("/auth/register", { method: "POST", body }),
    me: () => request<User>("/auth/me"),
    logout: () => tokenStore.clear(),
    forgotPassword: (email: string) =>
      request<{ detail: string }>("/auth/forgot-password", { method: "POST", body: { email } }),
    resetPassword: (body: { token: string; new_password: string }) =>
      request<{ detail: string }>("/auth/reset-password", { method: "POST", body }),
  },
  users: {
    list: () => request<User[]>("/users"),
    get: (id: string) => request<User>(`/users/${id}`),
    getRuns: (id: string) => request<WorkflowRun[]>(`/users/${id}/runs`),
    updateMe: (body: { full_name?: string; password?: string }) =>
      request<User>("/users/me", { method: "PATCH", body }),
    update: (id: string, body: { username?: string; email?: string; password?: string; full_name?: string; is_active?: boolean; role?: string; is_superuser?: boolean }) =>
      request<User>(`/users/${id}`, { method: "PATCH", body }),
  },
  workspaces: {
    list: () => request<Workspace[]>("/workspaces"),
    create: (body: { name: string; description?: string }) =>
      request<Workspace>("/workspaces", { method: "POST", body }),
    get: (id: string) => request<Workspace>(`/workspaces/${id}`),
    update: (id: string, body: { name?: string; description?: string }) =>
      request<Workspace>(`/workspaces/${id}`, { method: "PATCH", body }),
    remove: (id: string) => request<void>(`/workspaces/${id}`, { method: "DELETE" }),
    members: {
      list: (id: string) => request<Member[]>(`/workspaces/${id}/members`),
      add: (id: string, body: { username: string; role: string }) =>
        request<Member>(`/workspaces/${id}/members`, { method: "POST", body }),
      update: (id: string, mid: string, role: string) =>
        request<Member>(`/workspaces/${id}/members/${mid}`, { method: "PATCH", body: { role } }),
      remove: (id: string, mid: string) =>
        request<void>(`/workspaces/${id}/members/${mid}`, { method: "DELETE" }),
    },
  },
  files: {
    tree: (ws: string, path = "") => request<DirListing>(`/workspaces/${ws}/files/tree${qs({ path })}`),
    read: (ws: string, path: string) => request<FileContent>(`/workspaces/${ws}/files/content${qs({ path })}`),
    write: (ws: string, path: string, content: string) =>
      request<FileNode>(`/workspaces/${ws}/files/content${qs({ path })}`, { method: "PUT", body: { content } }),
    mkdir: (ws: string, path: string) =>
      request<FileNode>(`/workspaces/${ws}/files/mkdir`, { method: "POST", body: { path } }),
    rename: (ws: string, src: string, dst: string) =>
      request<FileNode>(`/workspaces/${ws}/files/rename`, { method: "POST", body: { src, dst } }),
    remove: (ws: string, path: string) =>
      request<{ detail: string }>(`/workspaces/${ws}/files${qs({ path })}`, { method: "DELETE" }),
    upload: (ws: string, path: string, file: File) => {
      const fd = new FormData();
      fd.append("file", file);
      return request<FileNode>(`/workspaces/${ws}/files/upload${qs({ path })}`, { method: "POST", body: fd });
    },
  },
  git: {
    status: (ws: string) => request<GitStatus>(`/workspaces/${ws}/git/status`),
    init: (ws: string) => request<GitStatus>(`/workspaces/${ws}/git/init`, { method: "POST" }),
    commit: (ws: string, message: string) =>
      request<CommitInfo>(`/workspaces/${ws}/git/commit`, { method: "POST", body: { message, add_all: true } }),
    log: (ws: string) => request<CommitInfo[]>(`/workspaces/${ws}/git/log`),
    branches: (ws: string) => request<BranchInfo[]>(`/workspaces/${ws}/git/branches`),
    createBranch: (ws: string, name: string) =>
      request<BranchInfo[]>(`/workspaces/${ws}/git/branches`, { method: "POST", body: { name, checkout: true } }),
  },
  secrets: {
    list: (ws: string) => request<Secret[]>(`/workspaces/${ws}/secrets`),
    create: (ws: string, body: { key: string; value: string; description?: string }) =>
      request<Secret>(`/workspaces/${ws}/secrets`, { method: "POST", body }),
    remove: (ws: string, key: string) =>
      request<{ detail: string }>(`/workspaces/${ws}/secrets/${key}`, { method: "DELETE" }),
  },
  variables: {
    list: (ws: string) => request<Variable[]>(`/workspaces/${ws}/variables`),
    create: (ws: string, body: { key: string; value: string; description?: string }) =>
      request<Variable>(`/workspaces/${ws}/variables`, { method: "POST", body }),
    remove: (ws: string, key: string) =>
      request<{ detail: string }>(`/workspaces/${ws}/variables/${key}`, { method: "DELETE" }),
  },
  workflows: {
    list: (ws: string) => request<Workflow[]>(`/workspaces/${ws}/workflows`),
    create: (ws: string, body: Partial<Workflow>) =>
      request<Workflow>(`/workspaces/${ws}/workflows`, { method: "POST", body }),
    get: (ws: string, id: string) => request<Workflow>(`/workspaces/${ws}/workflows/${id}`),
    update: (ws: string, id: string, body: Partial<Workflow>) =>
      request<Workflow>(`/workspaces/${ws}/workflows/${id}`, { method: "PATCH", body }),
    remove: (ws: string, id: string) =>
      request<{ detail: string }>(`/workspaces/${ws}/workflows/${id}`, { method: "DELETE" }),
    regenerateWebhook: (ws: string, id: string) =>
      request<Workflow>(`/workspaces/${ws}/workflows/${id}/regenerate-webhook`, { method: "POST" }),
    trigger: (ws: string, id: string) =>
      request<WorkflowRun>(`/workspaces/${ws}/workflows/${id}/trigger`, { method: "POST" }),
    runs: (ws: string, id: string) => request<WorkflowRun[]>(`/workspaces/${ws}/workflows/${id}/runs`),
    run: (ws: string, id: string, runId: string) =>
      request<WorkflowRun>(`/workspaces/${ws}/workflows/${id}/runs/${runId}`),
    cancel: (ws: string, id: string, runId: string) =>
      request<WorkflowRun>(`/workspaces/${ws}/workflows/${id}/runs/${runId}/cancel`, { method: "POST" }),
    replay: (ws: string, id: string, runId: string) =>
      request<WorkflowRun>(`/workspaces/${ws}/workflows/${id}/runs/${runId}/replay`, { method: "POST" }),
    comments: (ws: string, id: string) =>
      request<WorkflowComment[]>(`/workspaces/${ws}/workflows/${id}/comments`),
    addComment: (ws: string, id: string, body: { content: string }) =>
      request<WorkflowComment>(`/workspaces/${ws}/workflows/${id}/comments`, { method: "POST", body }),
    shares: (ws: string, id: string) =>
      request<WorkflowShare[]>(`/workspaces/${ws}/workflows/${id}/shares`),
    share: (ws: string, id: string, body: { user_id?: string | null; team_name?: string | null }) =>
      request<WorkflowShare>(`/workspaces/${ws}/workflows/${id}/shares`, { method: "POST", body }),
    deleteShare: (ws: string, id: string, shareId: string) =>
      request<{ detail: string }>(`/workspaces/${ws}/workflows/${id}/shares/${shareId}`, { method: "DELETE" }),
    transfer: (ws: string, id: string, body: { new_owner_id: string }) =>
      request<Workflow>(`/workspaces/${ws}/workflows/${id}/transfer`, { method: "POST", body }),
    checkConflicts: (ws: string, cron: string, workflowId?: string) =>
      request<{ conflicts: string[] }>(`/workspaces/${ws}/workflows/check-conflicts` + qs({ cron, workflow_id: workflowId }), { method: "POST" }),
  },
  notifications: {
    list: (unreadOnly = false) => request<Notification[]>(`/notifications${qs({ unread_only: unreadOnly })}`),
    unreadCount: () => request<{ count: number }>("/notifications/unread-count"),
    markRead: (id: string) => request<Notification>(`/notifications/${id}/read`, { method: "POST" }),
    markAllRead: () => request<{ detail: string }>("/notifications/read-all", { method: "POST" }),
  },
  connections: {
    catalog: (ws: string) =>
      request<ChannelCatalogItem[]>(`/workspaces/${ws}/connections/catalog`),
    list: (ws: string) => request<Connection[]>(`/workspaces/${ws}/connections`),
    create: (ws: string, body: { type: string; name: string; config: Record<string, string>; enabled?: boolean; schedule_cron?: string | null; schedule_tz?: string | null; schedule_to?: string | null }) =>
      request<Connection>(`/workspaces/${ws}/connections`, { method: "POST", body }),
    update: (ws: string, id: string, body: { name?: string; config?: Record<string, string>; enabled?: boolean; schedule_cron?: string | null; schedule_tz?: string | null; schedule_to?: string | null }) =>
      request<Connection>(`/workspaces/${ws}/connections/${id}`, { method: "PATCH", body }),
    remove: (ws: string, id: string) =>
      request<{ detail: string }>(`/workspaces/${ws}/connections/${id}`, { method: "DELETE" }),
    test: (ws: string, id: string, to: string, includeAttachment = false) =>
      request<ConnectionTestResult>(`/workspaces/${ws}/connections/${id}/test`, { method: "POST", body: { to, include_attachment: includeAttachment } }),
  },
  deliveries: {
    list: (params: { limit?: number; status?: string; channel?: string; workspace_id?: string } = {}) =>
      request<Delivery[]>(`/deliveries${qs(params)}`),
    listForWorkspace: (ws: string, params: { limit?: number; status?: string; channel?: string } = {}) =>
      request<Delivery[]>(`/workspaces/${ws}/deliveries${qs(params)}`),
  },
  dashboard: {
    stats: () => request<DashboardStats>("/dashboard/stats"),
    runs: (params: { limit?: number } = {}) => request<RecentRun[]>("/dashboard/runs" + qs(params)),
    heatmap: (ws: string) =>
      request<{ day: number; hour: number; count: number }[]>(`/workspaces/${ws}/workflows/dashboard/heatmap`),
    activity: (ws: string) =>
      request<ActivityLog[]>(`/workspaces/${ws}/workflows/activity`),
  },
  admin: {
    stats: () => request<AdminStats>("/admin/stats"),
    workers: () => request<WorkerInfo[]>("/admin/workers"),
    restartWorker: (name: string) =>
      request<{ detail: string }>(`/admin/workers/${name}/restart`, { method: "POST" }),
    createUser: (body: any) => request<User>("/users", { method: "POST", body }),
    listUsers: () => request<User[]>("/users"),
  },
};


