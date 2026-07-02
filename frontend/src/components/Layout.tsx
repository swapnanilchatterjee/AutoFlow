import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, FolderGit2, LayoutDashboard, LogOut, ScrollText, User, Workflow } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { Avatar, cn, Menu, MenuItem, MenuLabel, MenuSeparator } from "./ui";
import type { Notification } from "../lib/types";

const NAV = [
  { to: "/", label: "Dashboard", end: true, icon: LayoutDashboard },
  { to: "/workspaces", label: "Workspaces", icon: FolderGit2 },
  {to: "/deliveries", label: "Logs", icon: ScrollText},
  { to: "/notifications", label: "Notifications", icon: Bell },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);
  const [recentNotifications, setRecentNotifications] = useState<Notification[]>([]);

  const fetchRecent = () => {
    api.notifications.list()
      .then((res) => {
        setRecentNotifications(res.slice(0, 5));
      })
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

  useEffect(() => {
    fetchRecent();
  }, [unread]);

  function handleLogout() { logout(); navigate("/login"); }
  const displayName = user?.full_name || user?.username || "User";

  return (
    <div className="flex min-h-screen bg-slate-50/50 text-slate-800">
      {/* Sidebar */}
      <aside className="fixed inset-y-0 left-0 hidden w-[248px] flex-col border-r border-slate-100 bg-white md:flex">
        <Link to="/" className="flex items-center gap-3 px-6 py-6">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-md shadow-brand/10 transition-transform duration-300 hover:scale-105">
            <Workflow className="h-5 w-5" />
          </span>
          <div>
            <span className="block text-[16px] font-bold leading-none tracking-tight text-slate-900">AutoFlow</span>
            <span className="mt-1 block text-[11px] font-medium leading-none text-slate-400">Automation platform</span>
          </div>
        </Link>

        <div className="px-4">
          <p className="px-3 pb-2 pt-4 text-[10px] font-bold uppercase tracking-wider text-slate-400">Menu</p>
          <nav className="space-y-1">
            {NAV.map((n) => {
              const Icon = n.icon;
              return (
                <NavLink
                  key={n.to}
                  to={n.to}
                  end={n.end}
                  className={({ isActive }) =>
                    cn(
                      "group flex items-center justify-between rounded-lg px-3 py-2.5 text-sm font-semibold transition-all duration-200 border",
                      isActive
                        ? "bg-brand-50/60 text-brand-600 border-brand-100/50 shadow-sm shadow-brand/5"
                        : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-transparent",
                    )
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="flex items-center gap-3">
                        <Icon className={cn("h-[18px] w-[18px] transition-transform duration-200 group-hover:scale-105", isActive ? "text-brand" : "text-slate-400 group-hover:text-slate-600")} />
                        {n.label}
                      </span>
                      {n.to === "/notifications" && unread > 0 && (
                        <span className="rounded-full bg-brand-600 px-2 py-0.5 text-[10px] font-bold text-white tnum shadow-sm">
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

        <div className="mt-auto p-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 px-4 py-3 shadow-inner">
            <p className="text-[11px] font-bold text-slate-500">Self-hosted · Free</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-slate-400">All workflow runs execution remains local on your server.</p>
          </div>
        </div>
      </aside>

      {/* Main column */}
      <div className="flex min-h-screen flex-1 flex-col md:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-surface/90 px-5 backdrop-blur">
          <Link to="/" className="flex items-center gap-2 md:hidden">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand text-white">
              <Workflow className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold">AutoFlow</span>
          </Link>
          <div className="hidden md:block" />

          <div className="flex items-center gap-1">
            <Menu
              align="right"
              width="w-80"
              trigger={
                <button
                  className="relative inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted transition-colors hover:bg-hairline hover:text-ink"
                  aria-label="Notifications"
                >
                  <Bell className="h-[18px] w-[18px]" />
                  {unread > 0 && (
                    <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-danger ring-2 ring-surface" />
                  )}
                </button>
              }
            >
              <MenuLabel>Recent Notifications</MenuLabel>
              <MenuSeparator />
              <div className="max-h-80 overflow-y-auto">
                {recentNotifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-slate-400">
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
                        if (n.link) {
                          navigate(n.link);
                        }
                      }}
                      className={cn(
                        "flex w-full flex-col gap-1 border-b border-slate-50 px-4 py-2.5 text-left text-xs transition-colors hover:bg-slate-50 last:border-0",
                        !n.is_read && "bg-brand-50/20 font-medium"
                      )}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className={cn(
                          "font-bold truncate",
                          n.type === "success" ? "text-emerald-600" : "text-rose-600"
                        )}>
                          {n.title}
                        </span>
                        {!n.is_read && (
                          <span className="h-1.5 w-1.5 rounded-full bg-brand-600 shrink-0" />
                        )}
                      </div>
                      {n.message && <p className="text-slate-500 line-clamp-2">{n.message}</p>}
                      <span className="text-[10px] text-slate-400">
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
                  className="flex w-full items-center justify-center gap-1.5 rounded-lg py-1.5 text-center text-xs font-bold text-brand hover:bg-brand-50 transition-colors"
                >
                  See all notifications
                </button>
              </div>
            </Menu>

            <Menu
              align="right"
              width="w-56"
              trigger={
                <button className="flex items-center gap-2 rounded-lg py-1 pl-1 pr-2 transition-colors hover:bg-hairline">
                  <Avatar name={displayName} />
                  <span className="hidden text-left sm:block">
                    <span className="block max-w-[140px] truncate text-[13px] font-medium leading-tight">{displayName}</span>
                    <span className="block text-[11px] leading-tight text-faint">
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
              <MenuItem icon={<LogOut className="h-4 w-4" />} danger onClick={handleLogout}>
                Sign out
              </MenuItem>
            </Menu>
          </div>
        </header>

        <main className="flex-1 scroll-slim">
          <div className="mx-auto max-w-6xl px-5 py-8 sm:px-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
