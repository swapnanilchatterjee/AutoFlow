import { useCallback, useEffect, useState } from "react";
import { Copy, Key, Plus, Trash2 } from "lucide-react";
import { api } from "../lib/api";
import type { ApiToken, ApiTokenCreated } from "../lib/types";
import {
  Badge, Button, Card, EmptyState, ErrorText, Field, Input, Modal, PageHeader,
  Table, TBody, TD, TH, THead, TR, useToast,
} from "../components/ui";

export default function ApiTokens() {
  const toast = useToast();
  const [tokens, setTokens] = useState<ApiToken[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [tokenName, setTokenName] = useState("");
  const [creating, setCreating] = useState(false);

  const [newToken, setNewToken] = useState<ApiTokenCreated | null>(null);

  const [showDelete, setShowDelete] = useState<ApiToken | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setTokens(await api.tokens.list());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load tokens");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate() {
    if (!tokenName.trim()) return;
    setCreating(true);
    try {
      const created = await api.tokens.create(tokenName.trim());
      setNewToken(created);
      setTokenName("");
      setShowCreate(false);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to create token");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    if (!showDelete) return;
    setDeleting(true);
    try {
      await api.tokens.remove(showDelete.id);
      toast.success("Token revoked successfully");
      setShowDelete(null);
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke token");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="API Tokens"
        description="Manage personal access tokens for programmatic access to the AutoFlow API."
        actions={
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="h-4 w-4" /> Generate new token
          </Button>
        }
      />

      {error && <ErrorText>{error}</ErrorText>}

      {loading && !tokens ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" />
          ))}
        </div>
      ) : tokens && tokens.length === 0 ? (
        <EmptyState
          icon={<Key className="h-6 w-6" />}
          title="No API tokens yet"
          description="Generate a personal access token to use the AutoFlow API programmatically."
          action={
            <Button onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4" /> Generate new token
            </Button>
          }
        />
      ) : tokens ? (
        <Table>
          <THead>
            <TR>
              <TH>Name</TH>
              <TH>Token</TH>
              <TH>Created</TH>
              <TH>Last used</TH>
              <TH>Status</TH>
              <TH className="text-right">Actions</TH>
            </TR>
          </THead>
          <TBody>
            {tokens.map((t) => {
              const expired = t.expires_at && new Date(t.expires_at) < new Date();
              return (
                <TR key={t.id}>
                  <TD className="font-semibold text-slate-900 dark:text-white">
                    {t.name}
                  </TD>
                  <TD>
                    <code className="rounded-lg bg-slate-100 px-2 py-1 font-mono text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                      {t.token_prefix}
                    </code>
                  </TD>
                  <TD className="text-xs text-slate-500 dark:text-slate-400">
                    {new Date(t.created_at).toLocaleDateString(undefined, {
                      month: "short", day: "numeric", year: "numeric",
                    })}
                  </TD>
                  <TD className="text-xs text-slate-500 dark:text-slate-400">
                    {t.last_used_at
                      ? new Date(t.last_used_at).toLocaleDateString(undefined, {
                          month: "short", day: "numeric", year: "numeric",
                          hour: "2-digit", minute: "2-digit",
                        })
                      : "\u2014"}
                  </TD>
                  <TD>
                    {expired ? (
                      <Badge tone="warn">Expired</Badge>
                    ) : (
                      <Badge tone="ok">Active</Badge>
                    )}
                  </TD>
                  <TD className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-500/10"
                      onClick={() => setShowDelete(t)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TD>
                </TR>
              );
            })}
          </TBody>
        </Table>
      ) : null}

      {/* Create token modal */}
      <Modal
        open={showCreate}
        onClose={() => setShowCreate(false)}
        title="Generate new API token"
        description="Create a personal access token for programmatic API access."
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !tokenName.trim()}>
              {creating ? "Generating\u2026" : "Generate token"}
            </Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); handleCreate(); }} className="space-y-4">
          <Field label="Token name" htmlFor="token-name" help="Give your token a descriptive name so you can identify it later.">
            <Input
              id="token-name"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g. CI/CD pipeline token"
              autoFocus
            />
          </Field>
        </form>
      </Modal>

      {/* Token created modal — shown only once */}
      <Modal
        open={newToken !== null}
        onClose={() => setNewToken(null)}
        title="API token created"
        description="Copy this token now. You won't be able to see it again."
        size="md"
        footer={
          <Button onClick={() => setNewToken(null)}>Done</Button>
        }
      >
        {newToken && (
          <div className="space-y-4">
            <Field label="Token name">
              <Input value={newToken.name} disabled />
            </Field>
            <Field label="Full token">
              <div className="relative">
                <code className="block w-full rounded-xl border border-brand bg-brand-50 px-4 py-3 font-mono text-sm text-brand-800 break-all dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-300">
                  {newToken.token}
                </code>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(newToken.token);
                    toast.success("Token copied to clipboard");
                  }}
                  className="absolute right-2 top-2 rounded-lg p-1.5 text-brand hover:bg-brand-100 dark:hover:bg-brand-500/20 transition-colors"
                  title="Copy token"
                >
                  <Copy className="h-4 w-4" />
                </button>
              </div>
            </Field>
            <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-800/50 dark:text-slate-400">
              <p>For security, this token will only be shown once. Store it somewhere safe.</p>
            </div>
          </div>
        )}
      </Modal>

      {/* Delete confirmation modal */}
      <Modal
        open={showDelete !== null}
        onClose={() => setShowDelete(null)}
        title="Revoke API token"
        description="This will permanently invalidate this token. Any services using it will lose access."
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowDelete(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} disabled={deleting}>
              {deleting ? "Revoking\u2026" : "Revoke token"}
            </Button>
          </>
        }
      >
        {showDelete && (
          <p className="text-sm text-slate-600 dark:text-slate-300">
            Are you sure you want to revoke <strong className="text-slate-900 dark:text-white">{showDelete.name}</strong>?
            This action cannot be undone.
          </p>
        )}
      </Modal>
    </div>
  );
}
