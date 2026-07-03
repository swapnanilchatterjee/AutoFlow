import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null); setBusy(true);
    try { await login(username, password, remember); navigate("/"); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Login failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden animate-gradient-bg p-6">
      {/* Floating decorative shapes */}
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white/10 blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-purple-300/15 blur-3xl animate-float2 pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full bg-pink-300/10 blur-2xl animate-float3 pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-32 h-32 rounded-full bg-indigo-300/10 blur-2xl animate-float pointer-events-none" />
      {/* Geometric accents */}
      <div className="absolute top-40 right-40 w-20 h-20 rounded-2xl border border-white/10 backdrop-blur-sm rotate-45 animate-float2 pointer-events-none" />
      <div className="absolute bottom-40 left-40 w-16 h-16 rounded-xl bg-white/5 backdrop-blur-sm animate-float3 pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-12 h-12 rounded-full border-2 border-white/10 animate-float pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px]">
        {/* Logo + Branding */}
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg">Report Scheduler</h1>
          <p className="mt-2 text-sm text-white/80">Self-hosted automation platform</p>
        </div>

        {/* Login Card */}
        <div className="bg-white/95 backdrop-blur-xl border border-white/20 p-8 rounded-2xl shadow-2xl shadow-black/10">
          <h2 className="text-xl font-bold text-slate-900">Welcome back</h2>
          <p className="mb-7 mt-1.5 text-sm text-slate-500">Sign in to manage your pipelines and reports.</p>

          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
            <Field label="Username or email" htmlFor="username" labelClassName="!text-slate-700 text-sm font-medium">
              <Input
                id="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoFocus
                placeholder="name@example.com"
                className="!bg-white !border-slate-300 focus:!border-brand focus:!ring-2 focus:!ring-brand/20 !text-slate-900 placeholder:!text-slate-400 !h-11 rounded-xl text-sm transition-all shadow-sm"
              />
            </Field>

            <Field label="Password" htmlFor="password" labelClassName="!text-slate-700 text-sm font-medium">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                className="!bg-white !border-slate-300 focus:!border-brand focus:!ring-2 focus:!ring-brand/20 !text-slate-900 placeholder:!text-slate-400 !h-11 rounded-xl text-sm transition-all shadow-sm"
              />
            </Field>

            <div className="flex items-center justify-between select-none">
              <label className="flex items-center gap-2.5 cursor-pointer text-sm text-slate-600 hover:text-slate-800 transition-colors">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand/20 focus:ring-offset-0 focus:ring-2 focus:outline-none accent-brand"
                />
                Remember me
              </label>
              <Link to="/forgot-password" className="text-sm font-semibold text-brand hover:text-brand-700 transition-colors">
                Forgot password?
              </Link>
            </div>

            {error && <ErrorText>{error}</ErrorText>}

            <Button
              type="submit"
              disabled={busy}
              className="w-full !h-11 mt-2 text-sm font-semibold"
            >
              {busy ? "Signing in\u2026" : "Sign in"}
            </Button>
          </form>
        </div>

        {/* Footer */}
        <p className="mt-6 text-center text-sm text-white/70">
          New to Report Scheduler?{" "}
          <Link to="/register" className="font-semibold text-white hover:text-white/80 underline decoration-white/30 hover:decoration-white/50 underline-offset-4 transition-colors">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
}
