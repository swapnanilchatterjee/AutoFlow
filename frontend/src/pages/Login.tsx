import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Workflow } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input } from "../components/ui";

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null); setBusy(true);
    try { await login(username, password); navigate("/"); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Login failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-500 text-white shadow-lg shadow-brand/10 mb-3">
            <Workflow className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">AutoFlow</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Self-Hosted Automation</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-premium">
          <h1 className="text-xl font-bold text-slate-900">Welcome Back</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">Sign in to your account to manage pipelines.</p>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
            <Field label="Username or email" htmlFor="username">
              <Input id="username" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="you@example.com" />
            </Field>
            <Field label="Password" htmlFor="password">
              <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy} className="w-full mt-2 font-bold shadow-md shadow-brand/5">{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          No account? <Link to="/register" className="font-medium text-brand hover:text-brand-700">Create one</Link>
        </p>
      </div>
    </div>
  );
}
