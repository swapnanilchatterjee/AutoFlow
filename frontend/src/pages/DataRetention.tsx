import { useEffect, useState } from "react";
import { Check, RefreshCw, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "../lib/api";
import type { RetentionConfig } from "../lib/types";
import {
  Button, Card, CardBody, CardHeader, ErrorText, Field, Input, PageHeader, Select, useToast,
} from "../components/ui";

const DEFAULTS: RetentionConfig = {
  auto_delete_enabled: false,
  runs_value: 90,
  runs_unit: "days",
  logs_value: 90,
  logs_unit: "days",
};

const UNIT_OPTIONS = [
  { value: "days", label: "Days" },
  { value: "weeks", label: "Weeks" },
  { value: "months", label: "Months" },
];

export default function DataRetention() {
  const toast = useToast();
  const [config, setConfig] = useState<RetentionConfig>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.admin.retention.get()
      .then((cfg) => setConfig(cfg))
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load retention config"))
      .finally(() => setLoading(false));
  }, []);

  function update<K extends keyof RetentionConfig>(key: K, value: RetentionConfig[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const saved = await api.admin.retention.save(config);
      setConfig(saved);
      toast.success("Retention settings saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleCleanup() {
    setCleaning(true);
    setError(null);
    try {
      const result = await api.admin.retention.run();
      toast.success(result.detail);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Cleanup failed");
    } finally {
      setCleaning(false);
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
        title="Data Retention"
        description="Configure auto-deletion of old workflow runs and logs."
        actions={
          <div className="flex gap-2">
            <Button variant="danger" onClick={handleCleanup} disabled={cleaning || !config.auto_delete_enabled}>
              {cleaning ? (
                <><RefreshCw className="h-4 w-4 animate-spin" /> Cleaning&hellip;</>
              ) : (
                <><Trash2 className="h-4 w-4" /> Run Cleanup Now</>
              )}
            </Button>
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
              title="Auto-Delete Rules"
              description="Old records will be permanently deleted based on these rules."
            />
            <CardBody className="space-y-5">
              <Field label="Auto-delete runs older than" htmlFor="runs-value" help="WorkflowRun and StepRun records older than this will be deleted.">
                <div className="flex gap-3">
                  <Input
                    id="runs-value"
                    type="number"
                    min={1}
                    value={config.runs_value}
                    onChange={(e) => update("runs_value", parseInt(e.target.value) || 1)}
                    className="w-24"
                  />
                  <Select
                    value={config.runs_unit}
                    onChange={(e) => update("runs_unit", e.target.value)}
                    className="w-36"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </Select>
                </div>
              </Field>

              <Field label="Auto-delete logs older than" htmlFor="logs-value" help="Delivery log records older than this will be deleted.">
                <div className="flex gap-3">
                  <Input
                    id="logs-value"
                    type="number"
                    min={1}
                    value={config.logs_value}
                    onChange={(e) => update("logs_value", parseInt(e.target.value) || 1)}
                    className="w-24"
                  />
                  <Select
                    value={config.logs_unit}
                    onChange={(e) => update("logs_unit", e.target.value)}
                    className="w-36"
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </Select>
                </div>
              </Field>

              <Field label="Enable auto-deletion" htmlFor="auto-delete-enabled">
                <label className="inline-flex items-center gap-3 cursor-pointer">
                  <input
                    id="auto-delete-enabled"
                    type="checkbox"
                    checked={config.auto_delete_enabled}
                    onChange={(e) => update("auto_delete_enabled", e.target.checked)}
                    className="h-5 w-5 rounded border-slate-300 text-brand focus:ring-brand/30 dark:border-slate-600 dark:bg-slate-800"
                  />
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    Automatically delete old data on schedule
                  </span>
                </label>
              </Field>
            </CardBody>
          </Card>

          <ErrorText>{error}</ErrorText>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader
              title="Status"
              description="Current retention policy state."
              action={config.auto_delete_enabled ? <ToggleRight className="h-5 w-5 text-emerald-500" /> : <ToggleLeft className="h-5 w-5 text-slate-400" />}
            />
            <CardBody>
              <div className="space-y-3 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Status</span>
                  <span className={`font-medium ${config.auto_delete_enabled ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"}`}>
                    {config.auto_delete_enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Delete runs</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    &gt; {config.runs_value} {config.runs_unit}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500 dark:text-slate-400">Delete logs</span>
                  <span className="font-mono font-medium text-slate-800 dark:text-slate-200">
                    &gt; {config.logs_value} {config.logs_unit}
                  </span>
                </div>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardHeader
              title="Run Cleanup"
              description="Trigger immediate deletion of old data."
              action={<Trash2 className="h-5 w-5 text-slate-400" />}
            />
            <CardBody className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Clicking "Run Cleanup Now" will immediately delete all records older than the configured thresholds. This action cannot be undone.
              </p>
              <Button
                className="w-full"
                variant="danger"
                onClick={handleCleanup}
                disabled={cleaning || !config.auto_delete_enabled}
              >
                {cleaning ? (
                  <><RefreshCw className="h-4 w-4 animate-spin" /> Cleaning&hellip;</>
                ) : (
                  <><Trash2 className="h-4 w-4" /> Run Cleanup Now</>
                )}
              </Button>
              {!config.auto_delete_enabled && (
                <p className="text-xs text-amber-600 dark:text-amber-400 text-center">
                  Enable auto-deletion above first
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  );
}
