import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut, Monitor, Smartphone, Globe, XCircle } from "lucide-react";
import { tokenStore } from "../lib/api";
import {
  Badge, Button, Card, CardBody, EmptyState, PageHeader, useToast, fmtRelative,
} from "../components/ui";

interface SessionEntry {
  id: string;
  browser: string;
  os: string;
  ip: string;
  lastActive: string;
  createdAt: string;
  isCurrent: boolean;
}

function detectBrowser(ua: string): string {
  if (ua.includes("Firefox")) return "Firefox";
  if (ua.includes("Chrome")) return "Chrome";
  if (ua.includes("Safari")) return "Safari";
  if (ua.includes("Edge")) return "Edge";
  return "Unknown";
}

function detectOS(ua: string): string {
  if (ua.includes("Windows")) return "Windows";
  if (ua.includes("Mac")) return "macOS";
  if (ua.includes("Linux")) return "Linux";
  if (ua.includes("Android")) return "Android";
  if (ua.includes("iOS")) return "iOS";
  return "Unknown";
}

function getStoredSessions(): SessionEntry[] {
  try {
    const raw = localStorage.getItem("af_sessions");
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveSessions(sessions: SessionEntry[]) {
  localStorage.setItem("af_sessions", JSON.stringify(sessions));
}

export default function Sessions() {
  const navigate = useNavigate();
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionEntry[]>(() => getStoredSessions());

  const addCurrentSession = useCallback(() => {
    const existing = getStoredSessions();
    const ua = navigator.userAgent;
    const now = new Date().toISOString();
    const current: SessionEntry = {
      id: "current",
      browser: detectBrowser(ua),
      os: detectOS(ua),
      ip: "Current device",
      lastActive: now,
      createdAt: existing.find((s) => s.isCurrent)?.createdAt || now,
      isCurrent: true,
    };
    const filtered = existing.filter((s) => s.id !== "current");
    const updated = [current, ...filtered];
    saveSessions(updated);
    setSessions(updated);
  }, []);

  useEffect(() => {
    addCurrentSession();
  }, [addCurrentSession]);

  function handleSignOutOthers() {
    tokenStore.clear();
    localStorage.removeItem("af_sessions");
    toast.success("Signed out of all sessions. Please log in again.");
    setTimeout(() => navigate("/login"), 1000);
  }

  return (
    <div>
      <PageHeader
        title="Sessions"
        description="Active sessions on your account."
        actions={
          <Button variant="danger" onClick={handleSignOutOthers}>
            <XCircle className="h-4 w-4" /> Sign out all other sessions
          </Button>
        }
      />

      {sessions.length === 0 ? (
        <EmptyState
          icon={<Monitor className="h-5 w-5" />}
          title="No sessions recorded"
          description="Session tracking will appear here after your next login."
        />
      ) : (
        <div className="space-y-4">
          {sessions.map((s) => (
            <Card key={s.id}>
              <CardBody>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-4">
                    <div className="mt-1 flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                      {s.os === "Windows" || s.os === "macOS" || s.os === "Linux" ? (
                        <Monitor className="h-5 w-5" />
                      ) : (
                        <Smartphone className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-slate-800 dark:text-slate-200">
                          {s.browser} on {s.os}
                        </span>
                        {s.isCurrent && <Badge tone="ok">Current session</Badge>}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-400 dark:text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Globe className="h-3 w-3" /> {s.ip}
                        </span>
                        <span>Last active: {fmtRelative(s.lastActive)}</span>
                        <span>Created: {fmtRelative(s.createdAt)}</span>
                      </div>
                    </div>
                  </div>
                  {!s.isCurrent && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const updated = sessions.filter((x) => x.id !== s.id);
                        saveSessions(updated);
                        setSessions(updated);
                        toast.success("Session removed");
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
