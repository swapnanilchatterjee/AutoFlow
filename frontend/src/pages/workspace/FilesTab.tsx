import { useCallback, useEffect, useState } from "react";
import {
  ChevronRight, File, FilePlus2, Folder, FolderPlus, GitBranch, GitCommitHorizontal,
  Save, Trash2, Upload,
} from "lucide-react";
import { api } from "../../lib/api";
import type { CommitInfo, DirListing, GitStatus } from "../../lib/types";
import {
  Badge, Button, Card, CardBody, CardHeader, EmptyState, ErrorText, Field,
  Input, Modal, Skeleton, Textarea, cn, useToast,
} from "../../components/ui";

export default function FilesTab({ wsId, canWrite }: { wsId: string; canWrite: boolean }) {
  const toast = useToast();
  const [path, setPath] = useState("");
  const [listing, setListing] = useState<DirListing | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<null | "file" | "dir">(null);
  const [newName, setNewName] = useState("");

  const loadDir = (p: string) => {
    api.files.tree(wsId, p).then((d) => { setListing(d); setPath(p); }).catch((e) => setError(e.message));
  };
  useEffect(() => { loadDir(""); }, [wsId]);

  function openFile(filePath: string) {
    setError(null);
    api.files.read(wsId, filePath).then((f) => {
      setSelected(filePath); setContent(f.content); setDirty(false);
    }).catch((e) => setError(e.message));
  }

  async function save() {
    if (!selected) return;
    try { await api.files.write(wsId, selected, content); setDirty(false); toast.success("File saved"); }
    catch (e) { setError(e instanceof Error ? e.message : "Save failed"); }
  }

  async function create() {
    const target = path ? `${path}/${newName}` : newName;
    try {
      if (creating === "dir") await api.files.mkdir(wsId, target);
      else await api.files.write(wsId, target, "");
      setCreating(null); setNewName(""); loadDir(path);
    } catch (e) { setError(e instanceof Error ? e.message : "Failed"); }
  }

  async function del(p: string) {
    if (!confirm(`Delete ${p}?`)) return;
    await api.files.remove(wsId, p);
    if (selected === p) { setSelected(null); setContent(""); }
    loadDir(path);
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const target = path ? `${path}/${file.name}` : file.name;
    try {
      await api.files.upload(wsId, target, file);
      toast.success(`Uploaded ${file.name}`);
      loadDir(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  const crumbs = path ? path.split("/") : [];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <div className="space-y-5 lg:col-span-2">
        <Card>
          <div className="flex flex-wrap items-center gap-1 border-b border-hairline px-4 py-3 text-sm">
            <button className="font-medium text-muted transition-colors hover:text-ink" onClick={() => loadDir("")}>root</button>
            {crumbs.map((c, i) => (
              <span key={i} className="flex items-center gap-1">
                <ChevronRight className="h-3.5 w-3.5 text-faint" />
                <button className="text-muted transition-colors hover:text-ink" onClick={() => loadDir(crumbs.slice(0, i + 1).join("/"))}>{c}</button>
              </span>
            ))}
          </div>

          <div className="p-2">
            {!listing ? (
              <div className="space-y-1 p-2">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-7" />)}</div>
            ) : listing.entries.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted">Empty folder</p>
            ) : (
              <ul className="space-y-0.5">
                {listing.entries.map((e) => (
                  <li key={e.path} className="group flex items-center justify-between rounded-lg px-2 py-1.5 transition-colors hover:bg-hairline">
                    <button
                      className="flex min-w-0 items-center gap-2.5 text-sm"
                      onClick={() => (e.type === "dir" ? loadDir(e.path) : openFile(e.path))}
                    >
                      {e.type === "dir"
                        ? <Folder className="h-4 w-4 shrink-0 text-brand" />
                        : <File className="h-4 w-4 shrink-0 text-faint" />}
                      <span className={cn("truncate", selected === e.path ? "font-medium text-brand-700" : "text-ink")}>{e.name}</span>
                    </button>
                    {canWrite && (
                      <button
                        className="text-faint opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
                        onClick={() => del(e.path)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {canWrite && (
            <div className="flex justify-end gap-2 border-t border-hairline px-4 py-3">
              <label className="inline-flex cursor-pointer items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:shadow-focus disabled:pointer-events-none disabled:opacity-50 h-8 gap-1.5 px-3.5 text-[13px] rounded-lg bg-white text-slate-700 border border-slate-200/80 hover:bg-slate-50 hover:text-slate-800 shadow-sm hover:border-slate-300 active:shadow-sm">
                <Upload className="h-4 w-4" /> Upload
                <input
                  type="file"
                  className="hidden"
                  onChange={handleUpload}
                />
              </label>
              <Button size="sm" variant="secondary" onClick={() => setCreating("dir")}><FolderPlus className="h-4 w-4" /> Folder</Button>
              <Button size="sm" variant="secondary" onClick={() => setCreating("file")}><FilePlus2 className="h-4 w-4" /> File</Button>
            </div>
          )}
        </Card>

        <GitPanel wsId={wsId} canWrite={canWrite} />
      </div>

      <div className="lg:col-span-3">
        <Card className="flex h-full min-h-[420px] flex-col">
          {!selected ? (
            <div className="flex flex-1 items-center p-5">
              <EmptyState
                icon={<File className="h-5 w-5" />}
                title="No file open"
                description="Pick a file from the browser to view or edit it."
                className="w-full border-none"
              />
            </div>
          ) : (
            <>
              <CardHeader
                title={<span className="font-mono text-[13px]">{selected}</span>}
                action={
                  <div className="flex items-center gap-3">
                    {dirty && <Badge tone="warn">Unsaved</Badge>}
                    {canWrite && <Button size="sm" onClick={save} disabled={!dirty}><Save className="h-3.5 w-3.5" /> Save</Button>}
                  </div>
                }
              />
              <CardBody className="flex flex-1 flex-col">
                <Textarea
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setDirty(true); }}
                  readOnly={!canWrite}
                  className="min-h-[420px] flex-1 font-mono text-[13px] leading-relaxed"
                  spellCheck={false}
                />
              </CardBody>
            </>
          )}
        </Card>
      </div>

      <Modal
        open={creating !== null}
        onClose={() => setCreating(null)}
        title={creating === "dir" ? "New folder" : "New file"}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={() => setCreating(null)}>Cancel</Button>
            <Button type="button" onClick={create} disabled={!newName}>Create</Button>
          </>
        }
      >
        <form onSubmit={(e) => { e.preventDefault(); create(); }}>
          <Field label={`${creating === "dir" ? "Folder" : "File"} name`} htmlFor="new-name">
            <Input id="new-name" value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus placeholder={creating === "dir" ? "scripts" : "build.sh"} className="font-mono" />
          </Field>
          <div className="mt-4"><ErrorText>{error}</ErrorText></div>
        </form>
      </Modal>
      {error && !creating && <div className="lg:col-span-5"><ErrorText>{error}</ErrorText></div>}
    </div>
  );
}

function GitPanel({ wsId, canWrite }: { wsId: string; canWrite: boolean }) {
  const [status, setStatus] = useState<GitStatus | null>(null);
  const [log, setLog] = useState<CommitInfo[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.git.status(wsId).then(setStatus).catch(() => setStatus({ initialized: false } as GitStatus));
    api.git.log(wsId).then(setLog).catch(() => setLog([]));
  }, [wsId]);
  useEffect(() => { refresh(); }, [refresh]);

  async function init() { await api.git.init(wsId); refresh(); }
  async function commit() {
    setError(null);
    try { await api.git.commit(wsId, message); setMessage(""); refresh(); }
    catch (e) { setError(e instanceof Error ? e.message : "Commit failed"); }
  }

  const changeCount = status ? (status.staged?.length ?? 0) + (status.unstaged?.length ?? 0) + (status.untracked?.length ?? 0) : 0;

  return (
    <Card>
      <CardHeader
        title={<span className="flex items-center gap-2"><GitBranch className="h-4 w-4 text-faint" /> Git</span>}
        action={status?.initialized && status.branch ? <Badge tone="brand">{status.branch}</Badge> : undefined}
      />
      <CardBody>
        {!status?.initialized ? (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted">Not a git repository.</p>
            {canWrite && <Button size="sm" variant="secondary" onClick={init}>Initialize</Button>}
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              {status.clean ? "Working tree clean." : <span><span className="font-medium text-ink tnum">{changeCount}</span> change{changeCount === 1 ? "" : "s"} pending</span>}
            </p>
            {canWrite && !status.clean && (
              <div className="space-y-2">
                <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Commit message" />
                <div className="flex justify-end">
                  <Button size="sm" onClick={commit} disabled={!message}><GitCommitHorizontal className="h-4 w-4" /> Commit all</Button>
                </div>
              </div>
            )}
            <ErrorText>{error}</ErrorText>
            {log.length > 0 && (
              <ul className="space-y-2 border-t border-hairline pt-3">
                {log.slice(0, 5).map((c) => (
                  <li key={c.sha} className="flex items-center gap-2 text-xs">
                    <span className="rounded bg-hairline px-1.5 py-0.5 font-mono text-brand-700">{c.short_sha}</span>
                    <span className="truncate text-muted">{c.message}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
