import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { api } from "../lib/api";
import { cn } from "./ui";

const NAV = [
  { to: "/", label: "Dashboard", end: true, icon: "▣" },
  { to: "/workspaces", label: "Workspaces", icon: "▤" },
  { to: "/notifications", label: "Notifications", icon: "◔" },
];

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let active = true;
    const poll = () =>
      api.notifications.unreadCount().then((r) => active && setUnread(r.count)).catch(() => {});
    poll();
    const id = setInterval(poll, 20000);
    return () => { active = false; clearInterval(id); };
  }, []);

  function handleLogout() { logout(); navigate("/login"); }

  return (
    <div className="flex min-h-screen bg-zinc-950 text-zinc-100">
      <aside className="flex w-60 flex-col border-r border-zinc-800 bg-zinc-900/40">
        <Link to="/" className="flex items-center gap-2 px-5 py-5">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500 text-sm font-bold text-zinc-950">A</span>
          <span className="text-lg font-semibold">AutoFlow</span>
        </Link>
        <nav className="flex-1 space-y-1 px-3">
          {NAV.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              className={({ isActive }) =>
                cn(
                  "flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors",
                  isActive ? "bg-zinc-800 text-zinc-100" : "text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200",
                )
              }
            >
              <span className="flex items-center gap-3"><span className="text-zinc-500">{n.icon}</span>{n.label}</span>
              {n.to === "/notifications" && unread > 0 && (
                <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-950">{unread}</span>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="border-t border-zinc-800 p-3">
          <div className="mb-2 flex items-center gap-2 px-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-700 text-sm">
              {(user?.full_name || user?.username || "?").charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.full_name || user?.username}</p>
              <p className="truncate text-xs text-zinc-500">{user?.is_superuser ? "Admin" : user?.role}</p>
            </div>
          </div>
          <button onClick={handleLogout} className="w-full rounded-lg px-3 py-2 text-left text-sm text-zinc-400 hover:bg-zinc-800 hover:text-zinc-200">
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
