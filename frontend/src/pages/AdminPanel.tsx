import { useCallback, useEffect, useRef, useState } from "react";
import { Users, FolderGit2, Play, Activity, RefreshCw, Plus, CheckCircle, AlertTriangle } from "lucide-react";
import { api } from "../lib/api";
import type { AdminStats, WorkerInfo, User } from "../lib/types";
import {
  Badge, Button, Card, ErrorText, Field, Input, Modal, PageHeader, Skeleton,
  useToast, Select,
} from "../components/ui";

const WORKERS_TIMEOUT = 3000;

export default function AdminPanel() {
  const toast = useToast();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [workers, setWorkers] = useState<WorkerInfo[] | null>(null);
  const [users, setUsers] = useState<User[] | null>(null);
  const [workersLoading, setWorkersLoading] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);

  const [openUserModal, setOpenUserModal] = useState(false);
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");

  const [editUser, setEditUser] = useState<User | null>(null);
  const [editUsername, setEditUsername] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");
  const [editFullName, setEditFullName] = useState("");
  const [userRuns, setUserRuns] = useState<any[] | null>(null);

  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"stats" | "users" | "workers">("stats");
  const workersCalledRef = useRef(false);

  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try { setStats(await api.admin.stats()); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load stats"); }
    finally { setStatsLoading(false); }
  }, []);

  const loadUsers = useCallback(async () => {
    setUsersLoading(true);
    try { setUsers(await api.admin.listUsers()); }
    catch (e) { setError(e instanceof Error ? e.message : "Failed to load users"); }
    finally { setUsersLoading(false); }
  }, []);

  const loadWorkers = useCallback(async () => {
    setWorkersLoading(true);
    try {
      const result = await Promise.race([
        api.admin.workers(),
        new Promise<null>((_, reject) => setTimeout(() => reject(new Error("Workers request timed out")), WORKERS_TIMEOUT)),
      ]);
      setWorkers(result);
    } catch (e) {
      setWorkers([]);
      if (e instanceof Error && e.message !== "Workers request timed out") {
        console.warn("Workers fetch failed:", e.message);
      }
    } finally {
      setWorkersLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
    loadUsers();
  }, [loadStats, loadUsers]);

  useEffect(() => {
    if (activeTab === "workers") {
      if (!workersCalledRef.current) {
        workersCalledRef.current = true;
        loadWorkers();
      }
    }
  }, [activeTab, loadWorkers]);

  async function handleCreateUser() {
    setError(null);
    setBusy(true);
    try {
      await api.admin.createUser({ email, username, password, full_name: fullName || null });
      setOpenUserModal(false);
      setEmail(""); setUsername(""); setPassword(""); setFullName("");
      toast.success(`User @${username} created successfully`);
      loadUsers();
      loadStats();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create user");
    } finally {
      setBusy(false);
    }
  }

  async function handleRestartWorker(name: string) {
    try {
      await api.admin.restartWorker(name);
      toast.success(`Restart signal sent to worker ${name}`);
      setTimeout(loadWorkers, 3000);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to restart worker");
    }
  }

  return (
    <div>
      <PageHeader
        title="Admin Panel"
        description="Global system administration, worker scaling, and account provisioning."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { loadStats(); loadUsers(); if (workersCalledRef.current) loadWorkers(); }}>
              <RefreshCw className="h-4 w-4" /> Sync
            </Button>
            <Button onClick={() => setOpenUserModal(true)}>
              <Plus className="h-4 w-4" /> Provision User
            </Button>
          </div>
        }
      />

      <div className="flex border-b border-slate-200 dark:border-slate-800 mb-6 gap-2">
        {(["stats", "users", "workers"] as const).map((tab) => {
          const loading = tab === "stats" ? statsLoading : tab === "users" ? usersLoading : workersLoading;
          return (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-sm font-semibold border-b-2 transition-all inline-flex items-center gap-2 ${
                activeTab === tab
                  ? "border-brand text-brand dark:border-brand-400 dark:text-brand-300"
                  : "border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200"
              }`}
            >
              {tab === "stats" ? "System Stats" : tab === "users" ? `User Management` : "Celery Workers"}
              {loading && (
                <span className="h-2 w-2 rounded-full bg-brand animate-rail-pulse" />
              )}
            </button>
          );
        })}
      </div>

      {activeTab === "stats" && (
        <div key="stats" className="space-y-6 animate-fade-in">
          {statsLoading && !stats ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-28" />)}
            </div>
          ) : stats ? (
            <>
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-2xl font-black text-slate-800 dark:text-white">{stats.total_users}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Total Provisioned Users</span>
                    </div>
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-300">
                      <Users className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-2xl font-black text-slate-800 dark:text-white">{stats.total_workspaces}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Active Workspaces</span>
                    </div>
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-600 dark:text-violet-300">
                      <FolderGit2 className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-2xl font-black text-slate-800 dark:text-white">{stats.total_workflows}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Configured Workflows</span>
                    </div>
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-sky-50 dark:bg-sky-500/10 text-sky-600 dark:text-sky-300">
                      <Play className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
                <Card className="p-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="block text-2xl font-black text-slate-800 dark:text-white">{stats.total_runs}</span>
                      <span className="mt-1 block text-xs font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Completed Run Executions</span>
                    </div>
                    <div className="h-10 w-10 flex items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300">
                      <Activity className="h-5 w-5" />
                    </div>
                  </div>
                </Card>
              </div>
              <Card className="p-6">
                <h3 className="text-sm font-bold text-slate-800 dark:text-white mb-4 uppercase tracking-wider">Run Executions Performance</h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-800 text-center">
                    <span className="block text-[28px] font-black text-emerald-600 dark:text-emerald-400">{stats.success_runs}</span>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Successful Runs</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-800 text-center">
                    <span className="block text-[28px] font-black text-red-600 dark:text-red-400">{stats.failed_runs}</span>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Failed Runs</span>
                  </div>
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border dark:border-slate-800 text-center">
                    <span className="block text-[28px] font-black text-brand dark:text-brand-300">
                      {stats.total_runs > 0 ? Math.round((stats.success_runs / stats.total_runs) * 100) : 100}%
                    </span>
                    <span className="text-xs font-medium text-slate-400 dark:text-slate-500">Overall Success Rate</span>
                  </div>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      )}

      {activeTab === "users" && (
        <Card className="overflow-hidden">
          {usersLoading && !users ? (
            <div className="p-6 space-y-4">{[0, 1, 2].map(i => <Skeleton key={i} className="h-8" />)}</div>
          ) : users && users.length === 0 ? (
            <div className="p-12 text-center text-sm text-slate-400 dark:text-slate-500">No users configured.</div>
          ) : users ? (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b bg-slate-50/80 dark:bg-slate-800/50 dark:border-slate-800">
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Username</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Full Name</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Email Address</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Role Status</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Created Date</th>
                    <th className="px-6 py-3.5 text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {users.map(u => (
                    <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="px-6 py-4 font-mono text-sm font-bold text-slate-800 dark:text-slate-200">@{u.username}</td>
                      <td className="px-6 py-4 text-sm text-slate-600 dark:text-slate-400">{u.full_name || "\u2014"}</td>
                      <td className="px-6 py-4 text-sm text-slate-500 dark:text-slate-400">{u.email}</td>
                      <td className="px-6 py-4">
                        <Select
                          value={u.is_superuser ? "superuser" : "standard"}
                          onChange={async (e) => {
                            const isSuper = e.target.value === "superuser";
                            try {
                              await api.users.update(u.id, { is_superuser: isSuper });
                              setUsers(prev => prev ? prev.map(usr => usr.id === u.id ? { ...usr, is_superuser: isSuper } : usr) : null);
                              toast.success(`User @${u.username} role updated`);
                            } catch (err) {
                              toast.error(err instanceof Error ? err.message : "Failed to update role");
                            }
                          }}
                          className="h-8 text-xs py-0.5 font-semibold"
                        >
                          <option value="superuser">Superuser</option>
                          <option value="standard">Standard User</option>
                        </Select>
                      </td>
                      <td className="px-6 py-4 text-xs text-slate-400 dark:text-slate-500">
                        {new Date(u.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => {
                            setEditUser(u);
                            setEditUsername(u.username);
                            setEditEmail(u.email);
                            setEditFullName(u.full_name || "");
                            setEditPassword("");
                            setUserRuns(null);
                          }}
                        >
                          Edit
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </Card>
      )}

      {activeTab === "workers" && (
        <div className="space-y-4">
          {workersLoading && !workers ? (
            [0, 1].map(i => <Skeleton key={i} className="h-[120px]" />)
          ) : workers && workers.length === 0 ? (
            <Card className="p-12 text-center text-sm text-slate-400 dark:text-slate-500">
              No workers found. Make sure Celery is running.
            </Card>
          ) : workers ? (
            workers.map(w => (
              <Card key={w.name} className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-1 p-2 rounded-lg shrink-0 ${
                      w.status === "healthy"
                        ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-300"
                        : "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-300"
                    }`}>
                      {w.status === "healthy" ? (
                        <CheckCircle className="h-5 w-5" />
                      ) : (
                        <AlertTriangle className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-mono text-sm font-bold text-slate-800 dark:text-white">{w.name}</h4>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        PID: {w.pid || "N/A"} \u00b7 Uptime: {Math.round(w.uptime / 60)} mins \u00b7 Active Tasks: {w.active_tasks}
                      </p>
                      {w.error && <p className="mt-2 text-xs font-mono text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-500/10 p-2 rounded border border-red-100 dark:border-red-500/20">{w.error}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={w.status === "healthy" ? "ok" : "danger"}>
                      {w.status === "healthy" ? "Running" : "Unresponsive"}
                    </Badge>
                    <Button size="sm" variant="secondary" onClick={() => handleRestartWorker(w.name)}>
                      <RefreshCw className="h-3.5 w-3.5" /> Restart Pool
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          ) : null}
        </div>
      )}

      <Modal
        open={openUserModal}
        onClose={() => setOpenUserModal(false)}
        title="Provision New User"
        description="Add a new administrator or workflow member account to AutoFlow."
        footer={
          <>
            <Button variant="secondary" onClick={() => setOpenUserModal(false)}>Cancel</Button>
            <Button onClick={handleCreateUser} disabled={busy || !email || !username || !password}>
              {busy ? "Provisioning\u2026" : "Provision User"}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }} className="space-y-4">
          <Field label="Username" htmlFor="new-username">
            <Input id="new-username" value={username} onChange={(e) => setUsername(e.target.value)} placeholder="e.g. janesmith" autoFocus />
          </Field>
          <Field label="Email Address" htmlFor="new-email">
            <Input id="new-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" />
          </Field>
          <Field label="Full Name" htmlFor="new-fullname">
            <Input id="new-fullname" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Jane Smith" />
          </Field>
          <Field label="Password" htmlFor="new-password">
            <Input id="new-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Enter password" />
          </Field>
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>

      {/* Edit User Modal */}
      <Modal
        open={editUser !== null}
        onClose={() => setEditUser(null)}
        title={`Edit User: @${editUser?.username || ""}`}
        description="View and modify user account details."
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditUser(null)}>Cancel</Button>
            <Button
              onClick={async () => {
                if (!editUser) return;
                setBusy(true);
                try {
                  const updated = await api.users.update(editUser.id, {
                    username: editUsername || undefined,
                    email: editEmail || undefined,
                    password: editPassword || undefined,
                    full_name: editFullName || undefined,
                  });
                  setUsers(prev => prev ? prev.map(u => u.id === editUser.id ? updated : u) : null);
                  toast.success(`User @${updated.username} updated`);
                  setEditUser(null);
                } catch (e) {
                  toast.error(e instanceof Error ? e.message : "Failed to update user");
                } finally {
                  setBusy(false);
                }
              }}
              disabled={busy}
            >
              {busy ? "Saving\u2026" : "Save changes"}
            </Button>
          </>
        }
      >
        {editUser && (
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Username" htmlFor="edit-username">
                <Input id="edit-username" value={editUsername} onChange={(e) => setEditUsername(e.target.value)} className="font-mono" />
              </Field>
              <Field label="Email" htmlFor="edit-email">
                <Input id="edit-email" type="email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              </Field>
            </div>
            <Field label="Full name" htmlFor="edit-fullname">
              <Input id="edit-fullname" value={editFullName} onChange={(e) => setEditFullName(e.target.value)} />
            </Field>
            <Field label="New password" htmlFor="edit-password" help="Leave blank to keep current password.">
              <Input id="edit-password" type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="Leave blank to keep" />
            </Field>

            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Created</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(editUser.created_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Last updated</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{new Date(editUser.updated_at).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Last password changed</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">
                  {editUser.last_password_changed ? new Date(editUser.last_password_changed).toLocaleString() : "Never"}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500 dark:text-slate-400">Account type</span>
                <span className="font-medium text-slate-700 dark:text-slate-300">{editUser.is_superuser ? "Administrator" : "Standard User"}</span>
              </div>
            </div>

            {/* User Run History */}
            <div>
              <button
                onClick={async () => {
                  if (userRuns) { setUserRuns(null); return; }
                  try { setUserRuns(await api.users.getRuns(editUser.id)); }
                  catch { setUserRuns([]); }
                }}
                className="text-sm font-semibold text-brand hover:text-brand-600 transition-colors"
              >
                {userRuns ? "Hide run history" : "View run history"}
              </button>
              {userRuns && (
                <div className="mt-3 space-y-2 max-h-60 overflow-y-auto">
                  {userRuns.length === 0 ? (
                    <p className="text-sm text-slate-400 dark:text-slate-500">No runs found for this user.</p>
                  ) : (
                    userRuns.map((r: any) => (
                      <div key={r.id} className="flex items-center justify-between rounded-lg bg-white dark:bg-slate-800 border dark:border-slate-700 px-4 py-2.5 text-sm">
                        <div>
                          <span className="font-semibold text-slate-700 dark:text-slate-300 tnum">#{r.run_number}</span>
                          <span className="ml-2 text-xs text-slate-400 dark:text-slate-500">{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold capitalize ${
                          r.status === "success" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300" :
                          r.status === "failed" ? "bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300" :
                          "bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-300"
                        }`}>
                          {r.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
