import { useEffect, useState } from "react";
import { Check, Mail, RefreshCw, Send, Server, Shield } from "lucide-react";
import { api } from "../lib/api";
import type { SmtpConfig } from "../lib/types";
import {
  Button, Card, CardBody, CardHeader, ErrorText, Field, Input, PageHeader, useToast,
} from "../components/ui";

const DEFAULTS: SmtpConfig = {
  smtp_host: "",
  smtp_port: 587,
  smtp_username: "",
  smtp_password: "",
  smtp_sender_email: "",
  smtp_sender_name: "",
  smtp_use_tls: true,
};

export default function SmtpSettings() {
  const toast = useToast();
  const [config, setConfig] = useState<SmtpConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin.smtp.get()
      .then((cfg) => setConfig(cfg))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load SMTP config"))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof SmtpConfig>(key: K, value: SmtpConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.admin.smtp.save(config);
      setConfig(saved);
      toast.success("SMTP settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleTest() {
    if (!testEmail.trim()) {
      toast.error("Enter a recipient email address");
      return;
    }
    setTesting(true);
    setError(null);
    try {
      const res = await api.admin.smtp.test(testEmail.trim());
      toast.success(res.detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Test failed");
    } finally {
      setTesting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-brand/30 border-t-brand" />
      </div>
    );
  }

  return (
    <div>
      <PageHeader
        title="SMTP Settings"
        description="Configure outgoing email for notifications and reports."
        actions={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={handleSave} disabled={saving}>
              {saving ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Saving&hellip;</>
              ) : (
                <><Check className="h-4 w-4" /> Save Settings</>
              )}
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader
              title="Server Configuration"
              description="Connection details for your SMTP relay."
            />
            <CardBody className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="SMTP Host" htmlFor="smtp-host" help="e.g. smtp.gmail.com">
                  <Input
                    id="smtp-host"
                    value={config.smtp_host}
                    onChange={(e) => update("smtp_host", e.target.value)}
                    placeholder="smtp.example.com"
                  />
                </Field>
                <Field label="Port" htmlFor="smtp-port" help="Common: 587 (TLS), 465 (SSL), 25">
                  <Input
                    id="smtp-port"
                    type="number"
                    value={config.smtp_port}
                    onChange={(e) => update("smtp_port", parseInt(e.target.value) || 587)}
                    placeholder="587"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Username" htmlFor="smtp-username" help="Full email address or login">
                  <Input
                    id="smtp-username"
                    value={config.smtp_username}
                    onChange={(e) => update("smtp_username", e.target.value)}
                    placeholder="user@example.com"
                  />
                </Field>
                <Field label="Password" htmlFor="smtp-password" help="App password or SMTP credentials">
                  <Input
                    id="smtp-password"
                    type="password"
                    value={config.smtp_password}
                    onChange={(e) => update("smtp_password", e.target.value)}
                    placeholder="Enter password"
                  />
                </Field>
              </div>

              <Field label="Use TLS" htmlFor="smtp-tls">
                <label className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    id="smtp-tls"
                    type="checkbox"
                    checked={config.smtp_use_tls}
                    onChange={(e) => update("smtp_use_tls", e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand/30 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Enable STARTTLS
                  </span>
                </label>
              </Field>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Sender Information"
              description="The name and address recipients will see."
            />
            <CardBody className="space-y-5">
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <Field label="Sender Email" htmlFor="smtp-sender-email" help="Must be accepted by your SMTP server">
                  <Input
                    id="smtp-sender-email"
                    type="email"
                    value={config.smtp_sender_email}
                    onChange={(e) => update("smtp_sender_email", e.target.value)}
                    placeholder="reports@example.com"
                  />
                </Field>
                <Field label="Sender Name" htmlFor="smtp-sender-name" help="Display name (optional)">
                  <Input
                    id="smtp-sender-name"
                    value={config.smtp_sender_name}
                    onChange={(e) => update("smtp_sender_name", e.target.value)}
                    placeholder="AutoFlow Reports"
                  />
                </Field>
              </div>
            </CardBody>
          </Card>

          <ErrorText>{error}</ErrorText>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Test Connection"
              description="Send a test email to verify your configuration."
              action={<Send className="h-5 w-5 text-slate-400" />}
            />
            <CardBody className="space-y-4">
              <Field label="Recipient Email" htmlFor="test-email">
                <Input
                  id="test-email"
                  type="email"
                  value={testEmail}
                  onChange={(e) => setTestEmail(e.target.value)}
                  placeholder="you@example.com"
                />
              </Field>
              <Button
                className="w-full"
                onClick={handleTest}
                disabled={testing || !testEmail.trim()}
              >
                {testing ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Sending&hellip;</>
                ) : (
                  <><Send className="h-4 w-4" /> Send Test Email</>
                )}
              </Button>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 text-sm text-slate-500 dark:text-slate-400">
                <p className="flex items-start gap-2">
                  <Shield className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>Password is stored encrypted and never exposed in logs or API responses.</span>
                </p>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Connection Status"
              action={<Server className="h-5 w-5 text-slate-400" />}
            />
            <CardBody>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Host</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {config.smtp_host || "\u2014"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Port</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {config.smtp_port}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Username</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    {config.smtp_username || "\u2014"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Sender</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {config.smtp_sender_email || "\u2014"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">TLS</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {config.smtp_use_tls ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
