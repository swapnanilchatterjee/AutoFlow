import { useCallback, useEffect, useState } from "react";
import { api } from "../../lib/api";
import type { CommitInfo, DirListing, GitStatus } from "../../lib/types";
import { Badge, Button, Card, EmptyState, ErrorText, Input, Label, Modal, Spinner, Textarea, cn } from "../../components/ui";

export default function FilesTab({ wsId, canWrite }: { wsId: string; canWrite: boolean }) {
  const [path, setPath] = useState("");
  const [listing, setListing] = useState<DirListing | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState<null | "file" | "dir">(null);
  const [newName, setNewName] = useState("");
  const [readmeContent, setReadmeContent] = useState<string | null>(null);

  const loadDir = (p: string) => {
    api.files.tree(wsId, p).then((d) => {
      setListing(d);
      setPath(p);
      const readme = d.entries.find(e => e.type === "file" && e.name.toLowerCase() === "readme.md");
      if (readme) {
        api.files.read(wsId, readme.path).then((f) => setReadmeContent(f.content)).catch(() => setReadmeContent(null));
      } else {
        setReadmeContent(null);
      }
    }).catch((e) => setError(e.message));
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
    try { await api.files.write(wsId, selected, content); setDirty(false); }
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

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    try {
      const targetPath = path ? `${path}/${file.name}` : file.name;
      await api.files.upload(wsId, targetPath, file);
      loadDir(path);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    }
  }

  async function del(p: string) {
    if (!confirm(`Delete ${p}?`)) return;
    await api.files.remove(wsId, p);
    if (selected === p) { setSelected(null); setContent(""); }
    loadDir(path);
  }

  const crumbs = path ? path.split("/") : [];

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <Card className="p-4">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex flex-wrap items-center gap-1 text-sm text-zinc-400">
              <button className="hover:text-zinc-200" onClick={() => loadDir("")}>root</button>
              {crumbs.map((c, i) => (
                <span key={i} className="flex items-center gap-1">
                  <span className="text-zinc-600">/</span>
                  <button className="hover:text-zinc-200" onClick={() => loadDir(crumbs.slice(0, i + 1).join("/"))}>{c}</button>
                </span>
              ))}
            </div>
          </div>
          {!listing ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : listing.entries.length === 0 ? (
            <p className="py-6 text-center text-sm text-zinc-500">Empty folder</p>
          ) : (
            <ul className="space-y-0.5">
              {listing.entries.map((e) => (
                <li key={e.path} className="group flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-zinc-800/60">
                  <button
                    className="flex min-w-0 items-center gap-2 text-sm"
                    onClick={() => (e.type === "dir" ? loadDir(e.path) : openFile(e.path))}
                  >
                    <span className="text-zinc-500">{e.type === "dir" ? "▸" : "▢"}</span>
                    <span className={cn("truncate", e.type === "dir" ? "text-zinc-200" : "text-zinc-300")}>{e.name}</span>
                  </button>
                  {canWrite && (
                    <button className="text-zinc-600 opacity-0 hover:text-red-400 group-hover:opacity-100" onClick={() => del(e.path)}>✕</button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {canWrite && (
            <div className="mt-3 flex flex-wrap justify-end gap-2 border-t border-zinc-800 pt-3">
              <input type="file" id="file-upload" className="hidden" onChange={handleUpload} />
              <Button variant="ghost" onClick={() => document.getElementById("file-upload")?.click()}>Upload file</Button>
              <Button variant="ghost" onClick={() => setCreating("dir")}>New folder</Button>
              <Button variant="ghost" onClick={() => setCreating("file")}>New file</Button>
            </div>
          )}
        </Card>
        <GitPanel wsId={wsId} canWrite={canWrite} />
      </div>

      <div className="lg:col-span-3">
        <Card className="flex h-full flex-col p-4">
          {!selected ? (
            <EmptyState title="No file open" hint="Pick a file from the browser to view or edit it." />
          ) : (
            <>
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-sm text-zinc-300">{selected}{dirty && <span className="ml-2 text-amber-400">●</span>}</span>
                {canWrite && <Button onClick={save} disabled={!dirty}>Save</Button>}
              </div>
              <Textarea
                value={content}
                onChange={(e) => { setContent(e.target.value); setDirty(true); }}
                readOnly={!canWrite}
                className="min-h-[420px] flex-1 font-mono text-xs leading-relaxed"
                spellCheck={false}
              />
            </>
          )}
        </Card>
      </div>

      <Modal open={creating !== null} onClose={() => setCreating(null)} title={creating === "dir" ? "New folder" : "New file"}>
        <form onSubmit={(e) => { e.preventDefault(); create(); }} className="space-y-4">
          <div><Label>{creating === "dir" ? "Folder" : "File"} name</Label>
            <Input value={newName} onChange={(e) => setNewName(e.target.value)} autoFocus placeholder={creating === "dir" ? "scripts" : "build.sh"} />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" type="button" onClick={() => setCreating(null)}>Cancel</Button>
            <Button type="submit" disabled={!newName}>Create</Button>
          </div>
        </form>
      </Modal>
      {error && !creating && <div className="lg:col-span-5"><ErrorText>{error}</ErrorText></div>}
      
      {readmeContent && (
        <div className="lg:col-span-5">
          <Card className="p-5">
            <div className="border-b border-zinc-800 pb-3 mb-4 flex items-center justify-between">
              <h3 className="font-semibold text-zinc-200 flex items-center gap-2">
                <span className="text-zinc-500">📖</span> README.md
              </h3>
            </div>
            <pre className="prose prose-invert max-w-none text-sm text-zinc-300 whitespace-pre-wrap font-sans leading-relaxed">
              {readmeContent}
            </pre>
          </Card>
        </div>
      )}
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
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-zinc-200">Git</h3>
        {status?.initialized && status.branch && <Badge>{status.branch}</Badge>}
      </div>
      {!status?.initialized ? (
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-500">Not a git repository.</p>
          {canWrite && <Button variant="subtle" onClick={init}>Initialize</Button>}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-zinc-400">
            {status.clean ? "Working tree clean" : <span>{changeCount} change{changeCount === 1 ? "" : "s"} pending</span>}
          </p>
          {canWrite && !status.clean && (
            <div className="space-y-2">
              <Input value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Commit message" />
              <div className="flex justify-end">
                <Button onClick={commit} disabled={!message}>Commit all</Button>
              </div>
            </div>
          )}
          <ErrorText>{error}</ErrorText>
          {log.length > 0 && (
            <ul className="space-y-1.5 border-t border-zinc-800 pt-3">
              {log.slice(0, 5).map((c) => (
                <li key={c.sha} className="flex items-center gap-2 text-xs">
                  <span className="font-mono text-emerald-400">{c.short_sha}</span>
                  <span className="truncate text-zinc-400">{c.message}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
