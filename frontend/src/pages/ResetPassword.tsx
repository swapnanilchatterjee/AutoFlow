import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, ApiError } from "../lib/api";
import { Button, ErrorText, Field, Input, useToast } from "../components/ui";

export default function ResetPassword() {
  const toast = useToast();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (!token) {
      setError("Token is missing. Check your reset link.");
      return;
    }

    setBusy(true);
    try {
      await api.auth.resetPassword({ token, new_password: password });
      toast.success("Password reset successfully. Please log in.");
      navigate("/login");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to reset password");
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
          <h2 className="text-xl font-bold text-slate-900">Choose New Password</h2>
          <p className="mb-7 mt-1.5 text-sm text-slate-500">Please enter and confirm your new password below.</p>

          <form onSubmit={submit} className="space-y-5">
            <Field label="New password" htmlFor="password" labelClassName="!text-slate-700 text-sm font-medium">
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                placeholder="Min 8 characters"
                className="!bg-white !border-slate-300 focus:!border-brand focus:!ring-2 focus:!ring-brand/20 !text-slate-900 placeholder:!text-slate-400 !h-11 rounded-xl text-sm transition-all shadow-sm"
                required
              />
            </Field>

            <Field label="Confirm new password" htmlFor="confirmPassword" labelClassName="!text-slate-700 text-sm font-medium">
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
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
              {busy ? "Resetting password\u2026" : "Reset Password"}
            </Button>

            {!token && (
              <p className="text-xs text-red-500 text-center font-semibold">
                Warning: Reset token is missing in URL! Please open a valid reset link.
              </p>
            )}

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
