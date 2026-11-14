import { EditProject } from "./types";

export type MediaInfo = {
  filename: string;
  kind: "video" | "audio";
  durationSec: number | null;
  width: number | null;
  height: number | null;
  hasAudio: boolean | null;
};

export type RenderJob = {
  id: string;
  status: "queued" | "rendering" | "done" | "error";
  progress: number;
  outputName: string;
  error: string | null;
  downloadUrl: string | null;
};

const asJson = async (res: Response) => {
  const text = await res.text();
  let payload: unknown = {};
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`Server returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    const message = (payload as { error?: string })?.error || `HTTP ${res.status}`;
    throw new Error(message);
  }
  return payload as never;
};

export const fetchMedia = async (): Promise<MediaInfo[]> => {
  const data = await asJson(await fetch("/api/media")) as { media: MediaInfo[] };
  return data.media;
};

export const uploadMedia = async (file: File): Promise<MediaInfo> => {
  const res = await fetch(`/api/upload?name=${encodeURIComponent(file.name)}`, {
    method: "POST",
    headers: { "content-type": file.type || "application/octet-stream" },
    body: file,
  });
  return asJson(res) as Promise<MediaInfo>;
};

export const startRender = async (
  project: EditProject,
  outputName: string,
): Promise<{ jobId: string }> => {
  const res = await fetch("/api/render", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...project, __outputName: outputName }),
  });
  return asJson(res) as Promise<{ jobId: string }>;
};

export const pollRender = async (jobId: string): Promise<RenderJob> => {
  const res = await fetch(`/api/render/${encodeURIComponent(jobId)}`);
  return asJson(res) as Promise<RenderJob>;
};
