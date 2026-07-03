import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  Bell, ChevronLeft, ChevronRight, FolderGit2, LayoutDashboard, LogOut, ScrollText,
  Settings, Shield, User, X, Menu, UserCog,
} from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import {
  Avatar, Button, cn, Field, Input, Menu as Dropdown, MenuItem, MenuLabel, MenuSeparator,
  Logo, Modal, ThemeToggle, useToast,
} from "./ui";
import type { Notification } from "../lib/types";

const NAV = [
  { to: "/", label: "Dashboard", end: true, icon: LayoutDashboard },
  { to: "/workspaces", label: "Workspaces", icon: FolderGit2 },
  { to: "/deliveries", label: "Logs", icon: ScrollText },
  { to: "/notifications", label: "Notifications", icon: Bell },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    return localStorage.getItem("af_sidebar_collapsed") === "true";
  });

  const navItems = NAV.filter(n => {
    if (n.to === "/deliveries" && !user?.is_superuser) return false;
    return true;
  });
  if (user?.is_superuser) {
    if (!navItems.find(n => n.to === "/admin")) {
      navItems.push({ to: "/admin", label: "Admin Panel", icon: Shield });
    }
  }

  const [unread, setUnread] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [settingsTab, setSettingsTab] = useState<"profile" | "account">("profile");
  const [fullName, setFullName] = useState(user?.full_name || "");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const fetchRecent = () => {
    api.notifications.list()
      .then((res) => { setRecentNotifications(res.slice(0, 5)); })
      .catch(() => {});
  };

  useEffect(() => {
    let active = true;
    const poll = () =>
      api.notifications.unreadCount().then((r) => active && setUnread(r.count)).catch(() => {});
    poll();
    const id = setInterval(poll, 20000);
    return () => { active = false; clearInterval(id); };
  }, []);

  useEffect(() => { fetchRecent(); }, [unread]);

  function toggleSidebar() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("af_sidebar_collapsed", String(next));
      return next;
    });
  }

  function handleLogout() { logout(); navigate("/login"); }
  const displayName = user?.full_name || user?.username || "User";
  const sidebarWidth = sidebarCollapsed ? "w-[72px]" : "w-[256px]";
  const sidebarPadding = sidebarCollapsed ? "md:pl-[72px]" : "md:pl-[256px]";

  return (
    <div className="flex min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-40 hidden flex-col border-r bg-white dark:bg-slate-900 dark:border-slate-800 transition-all duration-300 md:flex",
        sidebarWidth,
      )}>
        <div className={cn(
          "flex items-center py-6",
          sidebarCollapsed ? "justify-center px-0" : "justify-between px-4",
        )}>
          {sidebarCollapsed ? (
            <Logo className="h-9 w-9" />
          ) : (
            <>
              <Link to="/" className="flex items-center gap-3">
                <Logo className="h-10 w-10" />
                <div>
                  <span className="block text-base font-bold leading-none tracking-tight text-slate-900 dark:text-white">Report Scheduler</span>
                  <span className="mt-1 block text-[11px] font-medium leading-none text-slate-400 dark:text-slate-500">Report delivery platform</span>
                </div>
              </Link>
              <button
                onClick={toggleSidebar}
                className="mr-1 inline-flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                title="Collapse sidebar"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <p className={cn(
            "pb-2 pt-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500",
            sidebarCollapsed ? "text-center" : "px-3",
          )}>
            {sidebarCollapsed ? "..." : "Menu"}
          </p>
          <nav className="space-y-1">
            {navItems.map((n) => {
              const Icon = n.icon;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-200",
                      isActive
                        ? "bg-gradient-to-r from-brand-50 to-indigo-50/50 text-brand-700 shadow-sm dark:from-brand-500/10 dark:to-indigo-500/5 dark:text-brand-300"
                        : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 hover:translate-x-0.5",
                      sidebarCollapsed && "justify-center px-0 py-3",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="flex items-center gap-3">
                        <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-brand dark:text-brand-300" : "text-slate-400 dark:text-slate-500")} />
                        {!sidebarCollapsed && n.label}
                      </span>
                      {!sidebarCollapsed && n.to === "/notifications" && unread > 0 && (
                        <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white tnum shadow-sm dark:bg-brand-400 dark:text-brand-950">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              );
            })}
          </nav>
        </div>

        {!sidebarCollapsed && (
          <div className="border-t p-4 dark:border-slate-800">
            <div className="rounded-2xl bg-gradient-to-br from-slate-50 to-slate-100/50 px-4 py-3 dark:from-slate-800/50 dark:to-slate-800/20 dark:border dark:border-slate-800">
              <p className="text-xs font-bold text-slate-600 dark:text-slate-400 tracking-wide">Report Scheduler v1.0</p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">All systems operational</p>
              <div className="mt-2 flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[10px] font-medium text-emerald-600 dark:text-emerald-400">Live</span>
              </div>
            </div>
          </div>
        )}

        {sidebarCollapsed && (
          <div className="border-t p-3 flex justify-center dark:border-slate-800">
            <button
              onClick={toggleSidebar}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
              title="Expand sidebar"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        )}
      </aside>

      {/* Main column */}
      <div className={cn("flex min-h-screen flex-1 flex-col transition-all duration-300", sidebarPadding)}>
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b bg-white/80 backdrop-blur-xl dark:bg-slate-950/80 dark:border-slate-800 px-6">
          <div className="flex items-center gap-3 md:hidden">
            <button
              onClick={() => setShowMobileMenu(true)}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-500 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200 transition-colors"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link to="/" className="flex items-center gap-2">
              <Logo className="h-9 w-9" />
              <span className="text-sm font-bold text-slate-900 dark:text-white">Report Scheduler</span>
            </Link>
          </div>
          <div className="hidden md:flex items-center">
            {sidebarCollapsed && (
              <button
                onClick={toggleSidebar}
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300 transition-colors"
                title="Expand sidebar"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1">
            <ThemeToggle />

            <Dropdown
              align="right"
              width="w-80"
              trigger={
                <button
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                  aria-label="Notifications"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unread > 0 && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-red-500 ring-2 ring-white dark:ring-slate-900" />
                  )}
                </button>
              }
            >
              <MenuLabel>Recent Notifications</MenuLabel>
              <MenuSeparator />
              <div className="max-h-80 overflow-y-auto">
                {recentNotifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400 dark:text-slate-500">
                    No notifications yet.
                  </div>
                ) : (
                  recentNotifications.map((n) => (
                    <button
                      key={n.id}
                      onClick={() => {
                        if (!n.is_read) {
                          api.notifications.markRead(n.id).then(() => {
                            api.notifications.unreadCount().then((r) => setUnread(r.count)).catch(() => {});
                          }).catch(() => {});
                        }
                        if (n.link) navigate(n.link);
                      }}
                      className={cn(
                        "flex w-full flex-col gap-1 border-b px-4 py-3 text-left text-xs transition-colors hover:bg-slate-50 last:border-0 dark:border-slate-800 dark:hover:bg-slate-800/50",
                        !n.is_read && "bg-brand-50/30 dark:bg-brand-500/5"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "font-bold truncate",
                          n.type === "success" ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"
                        )}>
                          {n.title}
                        </span>
                        {!n.is_read && <span className="h-1.5 w-1.5 rounded-full bg-brand shrink-0" />}
                      </div>
                      {n.message && <p className="text-slate-500 dark:text-slate-400 line-clamp-2">{n.message}</p>}
                      <span className="text-[10px] text-slate-400 dark:text-slate-500">
                        {new Date(n.created_at).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </button>
                  ))
                )}
              </div>
              <MenuSeparator />
              <div className="p-1">
                <button
                  onClick={() => navigate("/notifications")}
                  className="flex w-full items-center justify-center gap-1.5 rounded-xl py-2 text-center text-xs font-bold text-brand hover:bg-brand-50 dark:hover:bg-brand-500/10 transition-colors"
                >
                  See all notifications
                </button>
              </div>
            </Dropdown>

            <Dropdown
              align="right"
              width="w-60"
              trigger={
                <button className="flex items-center gap-2 rounded-xl py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 dark:hover:bg-slate-800">
                  <Avatar name={displayName} />
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[140px] truncate text-sm font-medium leading-tight text-slate-800 dark:text-slate-200">{displayName}</span>
                    <span className="block text-[11px] leading-tight text-slate-400 dark:text-slate-500">
                      {user?.is_superuser ? "Admin" : user?.role || "Member"}
                    </span>
                  </span>
                </button>
              }
            >
              <MenuLabel>{user?.email}</MenuLabel>
              <MenuSeparator />
              <MenuItem icon={<User className="h-4 w-4" />} onClick={() => navigate("/workspaces")}>
                Your workspaces
              </MenuItem>
              <MenuItem icon={<UserCog className="h-4 w-4" />} onClick={() => { setSettingsTab("profile"); setShowSettings(true); }}>
                Profile settings
              </MenuItem>
              <MenuItem icon={<Settings className="h-4 w-4" />} onClick={() => { setSettingsTab("account"); setShowSettings(true); }}>
                Account settings
              </MenuItem>
              <MenuSeparator />
              <MenuItem icon={<LogOut className="h-4 w-4" />} danger onClick={handleLogout}>
                Sign out
              </MenuItem>
            </Dropdown>
          </div>
        </header>

        <main className="flex-1 scroll-slim">
          <div className="px-6 py-8 sm:px-8 lg:px-10">
            <div key={location.pathname} className="animate-fade-in">
              <Outlet />
            </div>
          </div>
        </main>
      </div>

      {/* Settings Modal */}
      <Modal
        open={showSettings}
        onClose={() => setShowSettings(false)}
        title={settingsTab === "profile" ? "Profile Settings" : "Account Settings"}
        description={settingsTab === "profile" ? "Update your profile information." : "Manage your account preferences."}
        size="sm"
      >
        {settingsTab === "profile" ? (
          <div className="space-y-4">
            <Field label="Full name" htmlFor="settings-name">
              <Input
                id="settings-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Your name"
              />
            </Field>
            <Field label="Email">
              <Input value={user?.email || ""} disabled />
            </Field>
            <Field label="Username">
              <Input value={user?.username || ""} disabled />
            </Field>
            <div className="border-t pt-4 space-y-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Change password</p>
              <Field label="New password" htmlFor="settings-password" help="Leave blank to keep current password (min 8 characters).">
                <Input
                  id="settings-password"
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Enter new password"
                />
              </Field>
              <Field label="Confirm password" htmlFor="settings-confirm">
                <Input
                  id="settings-confirm"
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Confirm new password"
                />
              </Field>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="secondary" onClick={() => setShowSettings(false)}>Cancel</Button>
              <Button
                onClick={async () => {
                  if (newPassword && newPassword !== confirmPassword) {
                    toast.error("Passwords do not match");
                    return;
                  }
                  if (newPassword && newPassword.length < 8) {
                    toast.error("Password must be at least 8 characters");
                    return;
                  }
                  setSaving(true);
                  try {
                    await api.users.updateMe({
                      full_name: fullName || undefined,
                      password: newPassword || undefined,
                    });
                    toast.success("Profile updated");
                    setShowSettings(false);
                    setNewPassword("");
                    setConfirmPassword("");
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Failed to update");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                {saving ? "Saving\u2026" : "Save changes"}
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <Field label="Member since">
              <Input value={user?.created_at ? new Date(user.created_at).toLocaleDateString() : ""} disabled />
            </Field>
            <Field label="Account type">
              <Input value={user?.is_superuser ? "Administrator" : "Standard User"} disabled />
            </Field>
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-500 dark:text-slate-400">
              Password and security settings are managed through the login page.
            </div>
          </div>
        )}
      </Modal>

      {/* Mobile Sidebar/Drawer Overlay */}
      {showMobileMenu && (
        <div className="fixed inset-0 z-50 flex md:hidden bg-black/40 backdrop-blur-sm" onClick={() => setShowMobileMenu(false)}>
          <aside className="w-[260px] flex-col border-r bg-white flex h-full dark:bg-slate-900 dark:border-slate-800" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-6 border-b dark:border-slate-800">
              <Link to="/" className="flex items-center gap-3" onClick={() => setShowMobileMenu(false)}>
                <Logo className="h-10 w-10" />
                <span className="block text-sm font-bold text-slate-900 dark:text-white">Report Scheduler</span>
              </Link>
              <button onClick={() => setShowMobileMenu(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <p className="px-3 pb-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Menu</p>
              <nav className="space-y-1">
                {navItems.map((n) => {
                  const Icon = n.icon;
                  return (
                    <NavLink
                      key={n.to}
                      to={n.to}
                      end={n.end}
                      onClick={() => setShowMobileMenu(false)}
                      className={({ isActive }) =>
                        cn(
                          "group flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-semibold transition-all duration-150",
                          isActive
                            ? "bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300"
                            : "text-slate-500 hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200",
                        )
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <span className="flex items-center gap-3">
                            <Icon className={cn("h-[18px] w-[18px]", isActive ? "text-brand dark:text-brand-300" : "text-slate-400 dark:text-slate-500")} />
                            {n.label}
                          </span>
                          {n.to === "/notifications" && unread > 0 && (
                            <span className="rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white tnum">
                              {unread > 99 ? "99+" : unread}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
