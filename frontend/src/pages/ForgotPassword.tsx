import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input, useToast } from "../components/ui";

export default function ForgotPassword() {
  const toast = useToast();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
      toast.success("Reset link sent successfully");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to request password reset");
    } finally {
      setBusy(false);
    }
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
          <h2 className="text-xl font-bold text-slate-900">Reset Password</h2>

          {sent ? (
            <div className="mt-6 space-y-4">
              <p className="text-sm text-slate-600 leading-relaxed">
                If an account matches that email address, a password reset link has been dispatched.
              </p>
              <div className="rounded-xl bg-slate-50 border border-slate-200 p-4">
                <p className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-1">Local Setup Check</p>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Check your terminal/docker logs for a generated reset link if SMTP is not configured.
                </p>
              </div>
              <Link
                to="/login"
                className="mt-4 block w-full text-center py-2.5 bg-brand text-white rounded-xl text-sm font-semibold hover:bg-brand-700 transition-colors shadow-sm"
              >
                Return to Login
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-6 space-y-5">
              <p className="text-sm text-slate-500">
                Enter your registered email address below, and we'll send you a recovery link valid for 10 minutes.
              </p>

              <Field label="Email address" htmlFor="email" labelClassName="!text-slate-700 text-sm font-medium">
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  placeholder="name@example.com"
                  className="!bg-white !border-slate-300 focus:!border-brand focus:!ring-2 focus:!ring-brand/20 !text-slate-900 placeholder:!text-slate-400 !h-11 rounded-xl text-sm transition-all shadow-sm"
                  required
                />
              </Field>

              {error && <ErrorText>{error}</ErrorText>}

              <Button
                type="submit"
                disabled={busy}
                className="w-full !h-11 text-sm font-semibold"
              >
                {busy ? "Sending link\u2026" : "Send Link"}
              </Button>

              <div className="text-center">
                <Link to="/login" className="text-sm font-semibold text-brand hover:text-brand-700 underline decoration-brand/30 hover:decoration-brand/50 underline-offset-4 transition-colors">
                  Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
