import { useEffect, useState } from "react";
import { KeyRound, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import type { Secret, Variable } from "../../lib/types";
import {
  Button, Card, CardHeader, ErrorText, Field, IconButton, Input, Modal, useToast,
} from "../../components/ui";

export default function SecretsTab({ wsId, canManage }: { wsId: string; canManage: boolean }) {
  const toast = useToast();
  const [secrets, setSecrets] = useState<Secret[]>([]);
  const [vars, setVars] = useState<Variable[]>([]);
  const [modal, setModal] = useState<null | "secret" | "variable">(null);
  const [key, setKey] = useState("");
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  function load() {
    api.secrets.list(wsId).then(setSecrets).catch(() => {});
    api.variables.list(wsId).then(setVars).catch(() => {});
  }
  useEffect(() => { load(); }, [wsId]);

  async function create() {
    setError(null);
    try {
      if (modal === "secret") await api.secrets.create(wsId, { key, value });
      else await api.variables.create(wsId, { key, value });
      toast.success(`${modal === "secret" ? "Secret" : "Variable"} ${key} added`);
      setModal(null); setKey(""); setValue(""); load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card>
        <CardHeader
          title="Secrets"
          description="Encrypted at rest. Injected as env vars at run time."
          action={canManage ? <Button size="sm" variant="secondary" onClick={() => setModal("secret")}>Add secret</Button> : undefined}
        />
        {secrets.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No secrets yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {secrets.map((s) => (
              <li key={s.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex items-center gap-2">
                  <KeyRound className="h-4 w-4 text-faint" />
                  <span className="font-mono text-sm text-ink">{s.key}</span>
                  <span className="font-mono text-xs text-faint">••••••</span>
                </div>
                {canManage && (
                  <IconButton
                    className="hover:bg-danger-50 hover:text-danger"
                    onClick={async () => { await api.secrets.remove(wsId, s.key); toast.success(`Secret ${s.key} removed`); load(); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card>
        <CardHeader
          title="Variables"
          description="Plain config values, also injected as env vars."
          action={canManage ? <Button size="sm" variant="secondary" onClick={() => setModal("variable")}>Add variable</Button> : undefined}
        />
        {vars.length === 0 ? (
          <p className="px-5 py-6 text-sm text-muted">No variables yet.</p>
        ) : (
          <ul className="divide-y divide-hairline">
            {vars.map((v) => (
              <li key={v.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex min-w-0 items-center gap-2">
                  <span className="font-mono text-sm text-ink">{v.key}</span>
                  <span className="truncate font-mono text-xs text-muted">= {v.value}</span>
                </div>
                {canManage && (
                  <IconButton
                    className="hover:bg-danger-50 hover:text-danger"
                    onClick={async () => { await api.variables.remove(wsId, v.key); toast.success(`Variable ${v.key} removed`); load(); }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal
        open={modal !== null}
        onClose={() => setModal(null)}
        title={modal === "secret" ? "Add secret" : "Add variable"}
        description={modal === "secret" ? "The value is encrypted and never shown again." : undefined}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="button" onClick={create} disabled={!key || !value}>Add</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <Field label="Key" htmlFor="sv-key"><Input id="sv-key" value={key} onChange={(e) => setKey(e.target.value)} autoFocus className="font-mono" placeholder="API_KEY" /></Field>
          <Field label="Value" htmlFor="sv-val">
            <Input id="sv-val" value={value} onChange={(e) => setValue(e.target.value)} type={modal === "secret" ? "password" : "text"} className="font-mono" />
          </Field>
          <ErrorText>{error}</ErrorText>
        </form>
      </Modal>
    </div>
  );
}
