import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input } from "../components/ui";

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", username: "", password: "", full_name: "", admin_token: "" });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setForm({ ...form, [k]: e.target.value });

  async function submit() {
    setError(null); setBusy(true);
    try { await register(form.email, form.username, form.password, form.full_name || undefined, form.admin_token || undefined); navigate("/"); }
    catch (e) { setError(e instanceof ApiError ? e.message : "Registration failed"); }
    finally { setBusy(false); }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden animate-gradient-bg p-6">
      <div className="absolute top-20 left-20 w-64 h-64 rounded-full bg-white/10 blur-3xl animate-float pointer-events-none" />
      <div className="absolute bottom-20 right-20 w-80 h-80 rounded-full bg-purple-300/15 blur-3xl animate-float2 pointer-events-none" />
      <div className="absolute top-1/3 right-1/4 w-48 h-48 rounded-full bg-pink-300/10 blur-2xl animate-float3 pointer-events-none" />
      <div className="absolute bottom-1/3 left-1/4 w-32 h-32 rounded-full bg-indigo-300/10 blur-2xl animate-float pointer-events-none" />
      <div className="absolute top-40 right-40 w-20 h-20 rounded-2xl border border-white/10 backdrop-blur-sm rotate-45 animate-float2 pointer-events-none" />
      <div className="absolute bottom-40 left-40 w-16 h-16 rounded-xl bg-white/5 backdrop-blur-sm animate-float3 pointer-events-none" />
      <div className="absolute top-1/2 left-1/3 w-12 h-12 rounded-full border-2 border-white/10 animate-float pointer-events-none" />

      <div className="relative z-10 w-full max-w-[420px]">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white drop-shadow-lg">Report Scheduler</h1>
          <p className="mt-2 text-sm text-white/80">Self-hosted automation platform</p>
        </div>

        <div className="bg-white/95 backdrop-blur-xl border border-white/20 p-8 rounded-2xl shadow-2xl shadow-black/10">
          <h2 className="text-xl font-bold text-slate-900">Create Account</h2>
          <p className="mb-7 mt-1.5 text-sm text-slate-500">The first registered account receives platform admin rights.</p>

          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-5">
            <Field label="Full name" htmlFor="fn" labelClassName="!text-slate-700 text-sm font-medium">
              <Input
                id="fn"
                value={form.full_name}
                onChange={set("full_name")}
                placeholder="Ada Lovelace"
                className="!bg-white !border-slate-300 focus:!border-brand focus:!ring-2 focus:!ring-brand/20 !text-slate-900 placeholder:!text-slate-400 !h-11 rounded-xl text-sm transition-all shadow-sm"
              />
            </Field>

            <Field label="Email" htmlFor="em" labelClassName="!text-slate-700 text-sm font-medium">
              <Input
                id="em"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                className="!bg-white !border-slate-300 focus:!border-brand focus:!ring-2 focus:!ring-brand/20 !text-slate-900 placeholder:!text-slate-400 !h-11 rounded-xl text-sm transition-all shadow-sm"
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Username" htmlFor="un" labelClassName="!text-slate-700 text-sm font-medium">
                <Input
                  id="un"
                  value={form.username}
                  onChange={set("username")}
                  placeholder="username"
                  className="!bg-white !border-slate-300 focus:!border-brand focus:!ring-2 focus:!ring-brand/20 !text-slate-900 placeholder:!text-slate-400 !h-11 rounded-xl text-sm transition-all shadow-sm"
                />
              </Field>

              <Field label="Password" htmlFor="pw" labelClassName="!text-slate-700 text-sm font-medium" help="Min 8 characters.">
                <Input
                  id="pw"
                  type="password"
                  value={form.password}
                  onChange={set("password")}
                  placeholder="Min 8 characters"
                  className="!bg-white !border-slate-300 focus:!border-brand focus:!ring-2 focus:!ring-brand/20 !text-slate-900 placeholder:!text-slate-400 !h-11 rounded-xl text-sm transition-all shadow-sm"
                />
              </Field>
            </div>

            <Field label="Admin Registration Token" htmlFor="at" labelClassName="!text-slate-700 text-sm font-medium" help="Optional. Required only to claim Administrator role.">
              <Input
                id="at"
                type="password"
                value={form.admin_token}
                onChange={set("admin_token")}
                placeholder="Enter admin token if provided"
                className="!bg-white !border-slate-300 focus:!border-brand focus:!ring-2 focus:!ring-brand/20 !text-slate-900 placeholder:!text-slate-400 !h-11 rounded-xl text-sm transition-all shadow-sm"
              />
            </Field>

            {error && <ErrorText>{error}</ErrorText>}

            <Button
              type="submit"
              disabled={busy}
              className="w-full !h-11 text-sm font-semibold"
            >
              {busy ? "Creating account\u2026" : "Create account"}
            </Button>

            <div className="text-center">
              <Link to="/login" className="text-sm font-semibold text-brand hover:text-brand-700 underline decoration-brand/30 hover:decoration-brand/50 underline-offset-4 transition-colors">
                Back to sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
