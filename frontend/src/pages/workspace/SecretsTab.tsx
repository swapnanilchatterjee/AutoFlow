import { useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { Secret, Variable } from "../../lib/types";
import { Button, Card, ErrorText, Input, Label, Modal } from "../../components/ui";

export default function SecretsTab({ wsId, canManage }: { wsId: string; canManage: boolean }) {
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
      setModal(null); setKey(""); setValue(""); load();
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Secrets</h3>
            <p className="text-xs text-zinc-500">Encrypted. Injected as env vars at run time.</p>
          </div>
          {canManage && <Button variant="subtle" onClick={() => setModal("secret")}>Add secret</Button>}
        </div>
        {secrets.length === 0 ? <p className="py-4 text-sm text-zinc-500">No secrets.</p> : (
          <ul className="divide-y divide-zinc-800">
            {secrets.map((s) => (
              <li key={s.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-zinc-200">{s.key}</span>
                  <span className="font-mono text-xs text-zinc-600">••••••</span>
                </div>
                {canManage && <button className="text-zinc-600 hover:text-red-400" onClick={async () => { await api.secrets.remove(wsId, s.key); load(); }}>✕</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Card className="p-5">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-zinc-200">Variables</h3>
            <p className="text-xs text-zinc-500">Plain config values, also injected as env vars.</p>
          </div>
          {canManage && <Button variant="subtle" onClick={() => setModal("variable")}>Add variable</Button>}
        </div>
        {vars.length === 0 ? <p className="py-4 text-sm text-zinc-500">No variables.</p> : (
          <ul className="divide-y divide-zinc-800">
            {vars.map((v) => (
              <li key={v.id} className="flex items-center justify-between py-2.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm text-zinc-200">{v.key}</span>
                  <span className="font-mono text-xs text-zinc-500">= {v.value}</span>
                </div>
                {canManage && <button className="text-zinc-600 hover:text-red-400" onClick={async () => { await api.variables.remove(wsId, v.key); load(); }}>✕</button>}
              </li>
            ))}
          </ul>
        )}
      </Card>

      <Modal open={modal !== null} onClose={() => setModal(null)} title={modal === "secret" ? "Add secret" : "Add variable"}>
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <div><Label>Key</Label><Input value={key} onChange={(e) => setKey(e.target.value)} autoFocus className="font-mono" placeholder="API_KEY" /></div>
          <div><Label>Value</Label><Input value={value} onChange={(e) => setValue(e.target.value)} type={modal === "secret" ? "password" : "text"} className="font-mono" /></div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setModal(null)}>Cancel</Button>
            <Button type="submit" disabled={!key || !value}>Add</Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
