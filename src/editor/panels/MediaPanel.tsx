import React, { useCallback, useEffect, useRef, useState } from "react";
import { fetchMedia, MediaInfo, uploadMedia } from "../api";

type Props = {
  onAdd: (media: MediaInfo) => void;
};

export const MediaPanel: React.FC<Props> = ({ onAdd }) => {
  const [items, setItems] = useState<MediaInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setItems(await fetchMedia());
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const onUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of Array.from(files)) {
        await uploadMedia(f);
      }
      await reload();
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="panel" aria-label="Media library">
      <header className="panel-head">
        <h2>Media</h2>
        <div>
          <button type="button" onClick={() => void reload()}>
            Refresh
          </button>
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()}>
            {busy ? "Uploading…" : "Upload"}
          </button>
        </div>
      </header>
      <input
        ref={fileRef}
        type="file"
        accept="video/*,audio/*"
        multiple
        hidden
        onChange={(e) => void onUpload(e.target.files)}
      />
      {loading ? <p className="muted">Loading…</p> : null}
      {error ? <p className="error">{error}</p> : null}
      {!loading && items.length === 0 ? (
        <p className="muted">No media found in public/.</p>
      ) : null}
      <ul className="media-list">
        {items.map((m) => (
          <li key={m.filename}>
            <button
              type="button"
              className="media-item"
              title="Add to timeline"
              onClick={() => onAdd(m)}
            >
              <span className={`badge ${m.kind}`}>{m.kind}</span>
              <span className="fname">{m.filename}</span>
              <span className="meta">
                {m.durationSec ? `${m.durationSec.toFixed(1)}s` : "?"}
                {m.width ? ` · ${m.width}x${m.height}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
};
