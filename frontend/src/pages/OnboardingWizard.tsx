import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, Rocket, Sparkles } from "lucide-react";
import { api } from "../lib/api";
import type { Workspace } from "../lib/types";
import { Button, Card, CardBody, Field, Input, Logo, Spinner, useToast } from "../components/ui";

const HELLO_WORLD = `name: Hello World
env:
  GREETING: "Hello from AutoFlow"
steps:
  - name: Say hello
    run: echo "$GREETING"
`;

export default function OnboardingWizard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [wsName, setWsName] = useState("My First Workspace");
  const [wsDesc, setWsDesc] = useState("");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);

  useEffect(() => {
    api.workspaces.list().then((ws) => {
      if (ws.length > 0) {
        navigate("/", { replace: true });
      } else {
        setChecking(false);
      }
    }).catch(() => setChecking(false));
  }, [navigate]);

  async function handleCreateWorkspace() {
    setBusy(true);
    try {
      const ws = await api.workspaces.create({ name: wsName, description: wsDesc || undefined });
      setWorkspace(ws);
      toast.success(`Workspace "${ws.name}" created`);
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create workspace");
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateWorkflow() {
    if (!workspace) return;
    setBusy(true);
    try {
      await api.workflows.create(workspace.id, {
        name: "Hello World",
        definition: HELLO_WORLD,
        trigger_type: "manual",
      });
      toast.success("Workflow created");
      navigate(`/workspaces/${workspace.id}`, { replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create workflow");
    } finally {
      setBusy(false);
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-canvas">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100 p-4 dark:from-slate-950 dark:to-slate-900">
      <Card className="w-full max-w-lg">
        <div className="flex flex-col items-center px-6 pt-10 pb-2">
          <Logo className="mb-4 h-14 w-14" />
          <div className="flex items-center gap-2">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-300 ${
                  step === i
                    ? "bg-brand text-white shadow-md scale-110"
                    : step > i
                    ? "bg-emerald-500 text-white"
                    : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                }`}
              >
                {step > i ? <Check className="h-4 w-4" /> : i + 1}
              </div>
            ))}
          </div>
        </div>

        <CardBody className="space-y-6 px-8 pb-10 pt-4">
          {step === 0 && (
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-50 to-indigo-50 text-brand shadow-sm dark:from-brand-500/10 dark:to-indigo-500/10">
                <Sparkles className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Welcome to Report Scheduler</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Let's get you set up in 3 quick steps</p>
              </div>
              <Button size="lg" onClick={() => setStep(1)} className="w-full">
                <Rocket className="h-5 w-5" /> Get Started
              </Button>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-6">
              <div className="text-center space-y-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Create your first workspace</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">Workspaces group your workflows, files, and team members.</p>
              </div>
              <form onSubmit={(e) => { e.preventDefault(); handleCreateWorkspace(); }} className="space-y-4">
                <Field label="Workspace name" htmlFor="ws-name">
                  <Input id="ws-name" value={wsName} onChange={(e) => setWsName(e.target.value)} autoFocus required />
                </Field>
                <Field label="Description (optional)" htmlFor="ws-desc">
                  <Input id="ws-desc" value={wsDesc} onChange={(e) => setWsDesc(e.target.value)} placeholder="A short description of this workspace" />
                </Field>
                <Button type="submit" disabled={busy || !wsName.trim()} className="w-full">
                  {busy ? "Creating…" : "Create"}
                </Button>
              </form>
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col items-center text-center space-y-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-500 shadow-sm dark:bg-emerald-500/10">
                <Check className="h-8 w-8" />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Workspace ready!</h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-semibold text-slate-700 dark:text-slate-300">{workspace?.name}</span> has been created. Now let's create your first workflow.
                </p>
              </div>
              <div className="flex w-full flex-col gap-3">
                <Button size="lg" onClick={handleCreateWorkflow} disabled={busy} className="w-full">
                  {busy ? "Creating…" : "Create your first workflow"}
                </Button>
                <Button variant="secondary" size="lg" onClick={() => workspace && navigate(`/workspaces/${workspace.id}`, { replace: true })} className="w-full">
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
