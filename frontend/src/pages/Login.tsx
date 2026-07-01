import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Input, Label } from "../components/ui";

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
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 p-6 text-zinc-100">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500 text-base font-bold text-zinc-950">A</span>
          <span className="text-xl font-semibold">AutoFlow</span>
        </div>
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h1 className="text-lg font-semibold">Sign in</h1>
          <p className="mb-5 mt-1 text-sm text-zinc-500">Welcome back. Enter your details.</p>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
            <div>
              <Label>Username or email</Label>
              <Input value={username} onChange={(e) => setUsername(e.target.value)} autoFocus placeholder="you@example.com" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Signing in…" : "Sign in"}</Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-zinc-500">
          No account? <Link to="/register" className="text-emerald-400 hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
