import React, { useRef, useState } from "react";
import { pollRender, RenderJob, startRender } from "../api";
import { EditProject, normalizeProject } from "../types";

const stamp = () =>
  new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);

const downloadText = (name: string, mime: string, body: string) => {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export const ProjectPanel: React.FC<{
  project: EditProject;
  onReplace: (p: EditProject) => void;
}> = ({ project, onReplace }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const importJson = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    try {
      onReplace(normalizeProject(JSON.parse(await f.text())));
      setMsg("Project imported.");
    } catch (e) {
      setMsg(`Import failed: ${String((e as Error)?.message || e)}`);
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="panel" aria-label="Project file">
      <header className="panel-head">
        <h2>Project</h2>
      </header>
      <div className="btns">
        <button
          type="button"
          onClick={() =>
            downloadText(
              `project-${stamp()}.json`,
              "application/json",
              JSON.stringify(project, null, 2),
            )
          }
        >
          Save .json
        </button>
        <button type="button" onClick={() => fileRef.current?.click()}>
          Load .json
        </button>
      </div>
      <input ref={fileRef} type="file" accept=".json,application/json" hidden onChange={(e) => void importJson(e.target.files)} />
      <p className="muted">Autosaved to localStorage on every change.</p>
      {msg ? <p className={msg.startsWith("Import failed") ? "error" : "ok"}>{msg}</p> : null}
    </section>
  );
};

export const ExportPanel: React.FC<{ project: EditProject }> = ({ project }) => {
  const [jobId, setJobId] = useState<string | null>(null);
  const [job, setJob] = useState<RenderJob | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");

  const render = async () => {
    setBusy(true);
    setError(null);
    setJob(null);
    try {
      const out = (name.trim() || `edit-${stamp()}`).replace(/\.(mp4|webm)$/i, "");
      const res = await startRender(project, `${out}.mp4`);
      setJobId(res.jobId);
      poll(res.jobId);
    } catch (e) {
      setError(String((e as Error)?.message || e));
      setBusy(false);
    }
  };

  const poll = (id: string) => {
    const tick = async () => {
      try {
        const next = await pollRender(id);
        setJob(next);
        if (next.status === "done" || next.status === "error") {
          setBusy(false);
          if (next.status === "error") setError(next.error || "Render failed");
          return;
        }
        window.setTimeout(tick, 500);
      } catch (e) {
        setBusy(false);
        setError(String((e as Error)?.message || e));
      }
    };
    window.setTimeout(tick, 300);
  };

  const pct = job ? Math.round(job.progress * 100) : 0;

  return (
    <section className="panel" aria-label="Export">
      <header className="panel-head">
        <h2>Export</h2>
      </header>
      <label className="row">
        <span className="row-label">File name</span>
        <input
          type="text"
          value={name}
          placeholder="edit.mp4"
          onChange={(e) => setName(e.target.value)}
          className="grow"
        />
      </label>
      <div className="btns">
        <button type="button" disabled={busy || project.videoClips.length === 0} onClick={() => void render()}>
          {busy ? "Rendering…" : "Render MP4"}
        </button>
      </div>
      {busy || job ? (
        <div className="progress">
          <div className="bar" style={{ width: `${pct}%` }} />
          <span>{job?.status ?? "queued"} {pct}%</span>
        </div>
      ) : null}
      {error ? (
        <pre className="error scroll">{error}</pre>
      ) : null}
      {job?.status === "done" && job.downloadUrl ? (
        <p className="ok">
          <a href={job.downloadUrl}>{job.outputName}</a> ({pct}%)
        </p>
      ) : null}
      {jobId ? <p className="muted">job {jobId}</p> : null}
    </section>
  );
};
