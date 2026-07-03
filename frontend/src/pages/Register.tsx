import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input, Logo } from "../components/ui";

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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 p-6">
      {/* Premium dark grid background */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#1e293b_1px,transparent_1px),linear-gradient(to_bottom,#1e293b_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-20 pointer-events-none" />
      
      {/* Ambient background glow */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-brand/10 blur-[130px] pointer-events-none" />
 
      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-6 flex flex-col items-center">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 border border-slate-800 text-brand shadow-xl mb-3 transition-transform duration-300 hover:scale-105">
            <Logo className="h-5 w-5" />
          </span>
          <h2 className="text-2xl font-bold tracking-tight text-white leading-none">Report Scheduler</h2>
          <p className="mt-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Self-Hosted Automation</p>
        </div>
 
        <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-xl shadow-black/50">
          <h1 className="text-xl font-bold tracking-tight text-white">Create Account</h1>
          <p className="mb-6 mt-1.5 text-xs text-slate-400">The first registered account will receive platform admin rights, or use an Admin Token below.</p>
          
          <form onSubmit={(e) => { e.preventDefault(); submit(); }} className="space-y-4">
            <Field label="Full name" htmlFor="fn" labelClassName="!text-slate-300 text-xs font-medium">
              <Input
                id="fn"
                value={form.full_name}
                onChange={set("full_name")}
                placeholder="Ada Lovelace"
                className="!bg-slate-950 !border-slate-800/80 focus:!border-brand focus:!ring-brand/15 focus:!ring-2 !text-white placeholder:!text-slate-600 !h-10 rounded-lg text-sm transition-all"
              />
            </Field>
            
            <Field label="Email" htmlFor="em" labelClassName="!text-slate-300 text-xs font-medium">
              <Input
                id="em"
                type="email"
                value={form.email}
                onChange={set("email")}
                placeholder="you@example.com"
                className="!bg-slate-950 !border-slate-800/80 focus:!border-brand focus:!ring-brand/15 focus:!ring-2 !text-white placeholder:!text-slate-600 !h-10 rounded-lg text-sm transition-all"
              />
            </Field>
            
            <Field label="Username" htmlFor="un" labelClassName="!text-slate-300 text-xs font-medium">
              <Input
                id="un"
                value={form.username}
                onChange={set("username")}
                placeholder="username"
                className="!bg-slate-950 !border-slate-800/80 focus:!border-brand focus:!ring-brand/15 focus:!ring-2 !text-white placeholder:!text-slate-600 !h-10 rounded-lg text-sm transition-all"
              />
            </Field>
            
            <Field label="Password" htmlFor="pw" help={<span className="text-slate-500 text-[11px]">At least 8 characters.</span>} labelClassName="!text-slate-300 text-xs font-medium">
              <Input
                id="pw"
                type="password"
                value={form.password}
                onChange={set("password")}
                placeholder="Password"
                className="!bg-slate-950 !border-slate-800/80 focus:!border-brand focus:!ring-brand/15 focus:!ring-2 !text-white placeholder:!text-slate-600 !h-10 rounded-lg text-sm transition-all"
              />
            </Field>

            <Field label="Admin Registration Token" htmlFor="at" help={<span className="text-slate-500 text-[11px]">Optional. Required only to claim Administrator role.</span>} labelClassName="!text-slate-300 text-xs font-medium">
              <Input
                id="at"
                type="password"
                value={form.admin_token}
                onChange={set("admin_token")}
                placeholder="Token"
                className="!bg-slate-950 !border-slate-800/80 focus:!border-brand focus:!ring-brand/15 focus:!ring-2 !text-white placeholder:!text-slate-600 !h-10 rounded-lg text-sm transition-all"
              />
            </Field>
            
            {error && <ErrorText>{error}</ErrorText>}
            
            <Button
              type="submit"
              disabled={busy}
              className="w-full !h-10 mt-2 font-semibold text-white !bg-brand hover:!bg-brand/90 active:scale-[0.98] transition-all rounded-lg text-sm flex items-center justify-center shadow-lg shadow-brand/10 border-0"
            >
              {busy ? "Creating account…" : "Create account"}
            </Button>
          </form>
        </div>
        
        <p className="mt-5 text-center text-xs text-slate-500">
          Already have an account?{" "}
          <Link to="/login" className="font-semibold text-slate-300 hover:text-white underline decoration-slate-600 hover:decoration-slate-400 underline-offset-4 transition-colors">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}

