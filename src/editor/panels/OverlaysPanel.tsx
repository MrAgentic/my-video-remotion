import React, { useRef, useState } from "react";
import { parseSrt, parseVtt, serializeSrt, type Caption } from "@remotion/captions";
import { Action } from "../state";
import { CaptionCue, EditProject, newId, projectDurationSec } from "../types";
import { CheckboxField, ColorField, NumberField, TextField } from "../fields";

export const buildSrt = (captions: CaptionCue[]): string => {
  const lines: Caption[][] = captions.map((c) => [
    {
      text: c.text,
      startMs: Math.round(c.startSec * 1000),
      endMs: Math.round(c.endSec * 1000),
      timestampMs: null,
      confidence: null,
    },
  ]);
  return serializeSrt({ lines });
};

const cueFromCaption = (c: Caption): CaptionCue => ({
  id: newId(),
  text: c.text,
  startSec: c.startMs / 1000,
  endSec: c.endMs / 1000,
});

const download = (name: string, mime: string, body: string) => {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
};

export const TextPanel: React.FC<{
  project: EditProject;
  dispatch: React.Dispatch<Action>;
}> = ({ project, dispatch }) => (
  <section className="panel" aria-label="Text overlays">
    <header className="panel-head">
      <h2>Text ({project.textOverlays.length})</h2>
      <button
        type="button"
        onClick={() =>
          dispatch({ type: "text.add", item: { id: newId(), text: "New text", startSec: 0, durationSec: 3, xPct: 50, yPct: 15, fontSizePx: 64, color: "#ffffff", backgroundColor: "", bold: true } })
        }
      >
        Add text
      </button>
    </header>
    {project.textOverlays.length === 0 ? <p className="muted">No text overlays.</p> : null}
    {project.textOverlays.map((t, i) => (
      <div key={t.id} className="clip">
        <div className="clip-title">
          <strong>Text #{i + 1}</strong>
          <div className="btns">
            <button
              type="button"
              onClick={() => dispatch({ type: "text.delete", id: t.id })}
            >
              Delete
            </button>
          </div>
        </div>
        <div className="fields">
          <TextField
            label="Text"
            value={t.text}
            multiline
            onChange={(v) => dispatch({ type: "text.patch", id: t.id, patch: { text: v } })}
          />
          <NumberField
            label="Start (s)"
            value={t.startSec}
            min={0}
            onChange={(v) =>
              dispatch({ type: "text.patch", id: t.id, patch: { startSec: Math.max(0, v) } })
            }
          />
          <NumberField
            label="Duration (s)"
            value={t.durationSec}
            min={0.1}
            onChange={(v) =>
              dispatch({ type: "text.patch", id: t.id, patch: { durationSec: Math.max(0.1, v) } })
            }
          />
          <NumberField
            label="X (%)"
            value={t.xPct}
            min={0}
            max={100}
            step={1}
            onChange={(v) => dispatch({ type: "text.patch", id: t.id, patch: { xPct: v } })}
          />
          <NumberField
            label="Y (%)"
            value={t.yPct}
            min={0}
            max={100}
            step={1}
            onChange={(v) => dispatch({ type: "text.patch", id: t.id, patch: { yPct: v } })}
          />
          <NumberField
            label="Font size (px)"
            value={t.fontSizePx}
            min={4}
            step={1}
            onChange={(v) =>
              dispatch({ type: "text.patch", id: t.id, patch: { fontSizePx: Math.max(4, v) } })
            }
          />
          <ColorField
            label="Color"
            value={t.color}
            onChange={(v) => dispatch({ type: "text.patch", id: t.id, patch: { color: v } })}
          />
          <ColorField
            label="Background"
            value={t.backgroundColor || ""}
            onChange={(v) =>
              dispatch({ type: "text.patch", id: t.id, patch: { backgroundColor: v } })
            }
          />
          <CheckboxField
            label="Bold"
            value={t.bold}
            onChange={(v) => dispatch({ type: "text.patch", id: t.id, patch: { bold: v } })}
          />
        </div>
      </div>
    ))}
  </section>
);

export const CaptionsPanel: React.FC<{
  project: EditProject;
  dispatch: React.Dispatch<Action>;
}> = ({ project, dispatch }) => {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = async (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      const isVtt = /\.vtt$/i.test(file.name) || text.trimStart().startsWith("WEBVTT");
      const { captions } = isVtt
        ? parseVtt({ input: text })
        : parseSrt({ input: text, strict: false });
      if (captions.length === 0) {
        throw new Error("No cues found in file");
      }
      dispatch({ type: "captions.set", captions: captions.map(cueFromCaption) });
    } catch (e) {
      setError(String((e as Error)?.message || e));
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section className="panel" aria-label="Captions">
      <header className="panel-head">
        <h2>Captions ({project.captions.length})</h2>
        <div>
          <button type="button" onClick={() => fileRef.current?.click()}>
            Import .srt/.vtt
          </button>
          <button
            type="button"
            disabled={project.captions.length === 0}
            onClick={() =>
              download("captions.srt", "application/x-subrip", buildSrt(project.captions))
            }
          >
            Export .srt
          </button>
        </div>
      </header>
      <input
        ref={fileRef}
        type="file"
        accept=".srt,.vtt"
        hidden
        onChange={(e) => void onFile(e.target.files)}
      />
      {error ? <p className="error">{error}</p> : null}

      <div className="fields">
        <NumberField
          label="Caption size (px)"
          value={project.captionStyle.fontSizePx}
          min={4}
          step={1}
          onChange={(v) =>
            dispatch({ type: "captionStyle.patch", patch: { fontSizePx: Math.max(4, v) } })
          }
        />
        <ColorField
          label="Caption color"
          value={project.captionStyle.color}
          onChange={(v) => dispatch({ type: "captionStyle.patch", patch: { color: v } })}
        />
        <ColorField
          label="Caption bg"
          value={project.captionStyle.backgroundColor}
          onChange={(v) => dispatch({ type: "captionStyle.patch", patch: { backgroundColor: v } })}
        />
        <NumberField
          label="Bottom margin (px)"
          value={project.captionStyle.bottomMarginPx}
          min={0}
          step={1}
          onChange={(v) =>
            dispatch({
              type: "captionStyle.patch",
              patch: { bottomMarginPx: Math.max(0, v) },
            })
          }
        />
      </div>

      {project.captions.length === 0 ? (
        <p className="muted">No cues. Import sample.srt to try it.</p>
      ) : null}
      <div className="cue-list">
        {project.captions.map((c, i) => (
          <div key={c.id} className="cue">
            <span className="cue-index">{i + 1}</span>
            <input
              type="text"
              value={c.text}
              placeholder="Cue text"
              onChange={(e) =>
                dispatch({ type: "caption.patch", id: c.id, patch: { text: e.target.value } })
              }
            />
            <input
              type="number"
              step={0.05}
              title="Start (s)"
              value={c.startSec}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                dispatch({
                  type: "caption.patch",
                  id: c.id,
                  patch: { startSec: Math.max(0, Math.min(v, c.endSec - 0.01)) },
                });
              }}
            />
            <input
              type="number"
              step={0.05}
              title="End (s)"
              value={c.endSec}
              onChange={(e) => {
                const v = Number(e.target.value);
                if (!Number.isFinite(v)) return;
                dispatch({
                  type: "caption.patch",
                  id: c.id,
                  patch: { endSec: Math.max(0.01, Math.max(v, c.startSec + 0.01)) },
                });
              }}
            />
            <button
              type="button"
              onClick={() => dispatch({ type: "caption.delete", id: c.id })}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
      <div className="btns">
        <button
          type="button"
          onClick={() =>
            dispatch({
              type: "caption.add",
              item: {
                id: newId(),
                text: "",
                startSec: projectDurationSec(project),
                endSec: projectDurationSec(project) + 2,
              },
            })
          }
        >
          Add cue
        </button>
      </div>
    </section>
  );
};
