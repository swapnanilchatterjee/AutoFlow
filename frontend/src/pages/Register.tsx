import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Workflow } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input } from "../components/ui";

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
    <div className="flex min-h-screen items-center justify-center bg-slate-50/50 p-6">
      <div className="w-full max-w-md">
        <div className="mb-8 flex flex-col items-center">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-brand-600 to-indigo-50 text-white shadow-lg shadow-brand/10 mb-3">
            <Workflow className="h-6 w-6" />
          </span>
          <h2 className="text-2xl font-extrabold tracking-tight text-slate-900">AutoFlow</h2>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-400">Self-Hosted Automation</p>
        </div>
        <div className="rounded-2xl border border-slate-100 bg-white p-8 shadow-premium">
          <h1 className="text-xl font-bold text-slate-900">Create Account</h1>
          <p className="mb-6 mt-1 text-sm text-slate-500">The first registered account will receive platform admin rights.</p>
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
            <Field label="Full name" htmlFor="fn"><Input id="fn" value={form.full_name} onChange={set("full_name")} placeholder="Ada Lovelace" /></Field>
            <Field label="Email" htmlFor="em"><Input id="em" type="email" value={form.email} onChange={set("email")} placeholder="you@example.com" /></Field>
            <Field label="Username" htmlFor="un"><Input id="un" value={form.username} onChange={set("username")} placeholder="ada" /></Field>
            <Field label="Password" htmlFor="pw" help="At least 8 characters."><Input id="pw" type="password" value={form.password} onChange={set("password")} placeholder="••••••••" /></Field>
            <ErrorText>{error}</ErrorText>
            <Button type="submit" disabled={busy} className="w-full mt-2 font-bold shadow-md shadow-brand/5">{busy ? "Creating account…" : "Create account"}</Button>
          </form>
        </div>
        <p className="mt-4 text-center text-sm text-muted">
          Already have an account? <Link to="/login" className="font-medium text-brand hover:text-brand-700">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
