import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Input, Label } from "../components/ui";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", username: "", password: "", full_name: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setError(null); setBusy(true);
    try { await register(form.email, form.username, form.password, form.full_name || undefined); navigate("/"); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Registration failed"); }
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
          <h1 className="text-lg font-semibold">Create account</h1>
          <p className="mb-5 mt-1 text-sm text-zinc-500">The first account becomes the platform admin.</p>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
            <div><Label>Full name</Label><Input value={form.full_name} onChange={set("full_name")} placeholder="Ada Lovelace" /></div>
            <div><Label>Email</Label><Input type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" /></div>
            <div><Label>Username</Label><Input value={form.username} onChange={set("username")} placeholder="ada" /></div>
            <div><Label>Password</Label><Input type="password" value={form.password} onChange={set("password")} placeholder="At least 8 characters" /></div>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy} className="w-full">{busy ? "Creating…" : "Create account"}</Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-zinc-500">
          Already have an account? <Link to="/login" className="text-emerald-400 hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
