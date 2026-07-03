import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { api, tokenStore, authEvents } from "../lib/api";
import type { User } from "../lib/types";

interface AuthState {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string, remember?: boolean) => Promise<void>;
  register: (email: string, username: string, password: string, fullName?: string, adminToken?: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthCtx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function refreshUser() {
    if (!tokenStore.access) { setUser(null); setLoading(false); return; }
    try { setUser(await api.auth.me()); }
    catch { tokenStore.clear(); setUser(null); }
    finally { setLoading(false); }
  }

  useEffect(() => {
    refreshUser();
    authEvents.setHandler(() => {
      setUser(null);
    });
    return () => authEvents.setHandler(() => {});
  }, []);

  async function login(username: string, password: string, remember = true) {
    await api.auth.login(username, password, remember);
    setUser(await api.auth.me());
  }

  async function register(email: string, username: string, password: string, fullName?: string, adminToken?: string) {
    await api.auth.register({ email, username, password, full_name: fullName, admin_token: adminToken });
    await login(username, password);
  }

  function logout() { api.auth.logout(); setUser(null); }

  return (
    <AuthCtx.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
