import React from "react";
import { Action } from "../state";
import {
  clipDurationSec,
  EditProject,
  videoClipStartSec,
} from "../types";
import { CheckboxField, NumberField, SliderField } from "../fields";

type Props = {
  project: EditProject;
  dispatch: React.Dispatch<Action>;
  selectedVideoId: string | null;
  onSelectVideo: (id: string | null) => void;
};

const PanelHead: React.FC<{ title: string; children: React.ReactNode }> = ({
  title,
  children,
}) => (
  <header className="panel-head">
    <h2>{title}</h2>
    <div>{children}</div>
  </header>
);

export const VideoTrackPanel: React.FC<Props> = ({
  project,
  dispatch,
  selectedVideoId,
  onSelectVideo,
}) => {
  return (
    <section className="panel" aria-label="Video track">
      <PanelHead title={`Video track (${project.videoClips.length})`}>
        <span className="muted">sequential</span>
      </PanelHead>
      {project.videoClips.length === 0 ? (
        <p className="muted">Click a media file to add it.</p>
      ) : null}
      {project.videoClips.map((clip, i) => {
        const selected = clip.id === selectedVideoId;
        return (
          <div
            key={clip.id}
            className={`clip ${selected ? "selected" : ""}`}
            onClick={() => onSelectVideo(clip.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === "Enter") onSelectVideo(clip.id);
            }}
          >
            <div className="clip-title">
              <strong>
                #{i + 1} {clip.filename}
              </strong>
              <span className="muted">
                at {videoClipStartSec(project, i).toFixed(2)}s →{" "}
                {(videoClipStartSec(project, i) + clipDurationSec(clip)).toFixed(2)}s
              </span>
              <div className="btns">
                <button
                  type="button"
                  disabled={i === 0}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "video.move", id: clip.id, delta: -1 });
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  disabled={i === project.videoClips.length - 1}
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "video.move", id: clip.id, delta: 1 });
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    dispatch({ type: "video.delete", id: clip.id });
                    if (selected) onSelectVideo(null);
                  }}
                >
                  Delete
                </button>
              </div>
            </div>
            {selected ? (
              <div className="fields" onClick={(e) => e.stopPropagation()}>
                <NumberField
                  label="Trim in (s)"
                  value={clip.trimStartSec}
                  min={0}
                  step={0.05}
                  onChange={(v) =>
                    dispatch({
                      type: "video.patch",
                      id: clip.id,
                      patch: { trimStartSec: Math.max(0, Math.min(v, clip.trimEndSec - 0.01)) },
                    })
                  }
                />
                <NumberField
                  label="Trim out (s)"
                  value={clip.trimEndSec}
                  min={0.01}
                  step={0.05}
                  onChange={(v) =>
                    dispatch({
                      type: "video.patch",
                      id: clip.id,
                      patch: { trimEndSec: Math.max(0.01, Math.max(v, clip.trimStartSec + 0.01)) },
                    })
                  }
                />
                <SliderField
                  label="Volume"
                  value={clip.volume}
                  onChange={(v) =>
                    dispatch({ type: "video.patch", id: clip.id, patch: { volume: v } })
                  }
                />
                <CheckboxField
                  label="Muted"
                  value={clip.muted}
                  onChange={(v) =>
                    dispatch({ type: "video.patch", id: clip.id, patch: { muted: v } })
                  }
                />
              </div>
            ) : null}
          </div>
        );
      })}
    </section>
  );
};

export const AudioTrackPanel: React.FC<{
  project: EditProject;
  dispatch: React.Dispatch<Action>;
  onAddAudio: () => void;
}> = ({ project, dispatch, onAddAudio }) => {
  return (
    <section className="panel" aria-label="Audio track">
      <PanelHead title={`Audio track (${project.audioClips.length})`}>
        <button type="button" onClick={onAddAudio}>
          Add audio
        </button>
      </PanelHead>
      {project.audioClips.length === 0 ? (
        <p className="muted">No audio clips.</p>
      ) : null}
      {project.audioClips.map((clip, i) => (
        <div key={clip.id} className="clip">
          <div className="clip-title">
            <strong>
              #{i + 1} {clip.filename}
            </strong>
            <span className="muted">
              {clip.startSec.toFixed(2)}s + {clipDurationSec(clip).toFixed(2)}s
            </span>
            <div className="btns">
              <button
                type="button"
                onClick={() => dispatch({ type: "audio.delete", id: clip.id })}
              >
                Delete
              </button>
            </div>
          </div>
          <div className="fields">
            <NumberField
              label="Start (s)"
              value={clip.startSec}
              min={0}
              onChange={(v) =>
                dispatch({ type: "audio.patch", id: clip.id, patch: { startSec: Math.max(0, v) } })
              }
            />
            <NumberField
              label="Trim in (s)"
              value={clip.trimStartSec}
              min={0}
              step={0.05}
              onChange={(v) =>
                dispatch({
                  type: "audio.patch",
                  id: clip.id,
                  patch: {
                    trimStartSec: Math.max(0, Math.min(v, clip.trimEndSec - 0.01)),
                  },
                })
              }
            />
            <NumberField
              label="Trim out (s)"
              value={clip.trimEndSec}
              min={0.01}
              step={0.05}
              onChange={(v) =>
                dispatch({
                  type: "audio.patch",
                  id: clip.id,
                  patch: {
                    trimEndSec: Math.max(0.01, Math.max(v, clip.trimStartSec + 0.01)),
                  },
                })
              }
            />
            <SliderField
              label="Volume"
              value={clip.volume}
              onChange={(v) =>
                dispatch({ type: "audio.patch", id: clip.id, patch: { volume: v } })
              }
            />
            <CheckboxField
              label="Muted"
              value={clip.muted}
              onChange={(v) =>
                dispatch({ type: "audio.patch", id: clip.id, patch: { muted: v } })
              }
            />
          </div>
        </div>
      ))}
    </section>
  );
};

export const ProjectSettings: React.FC<{
  project: EditProject;
  dispatch: React.Dispatch<Action>;
}> = ({ project, dispatch }) => (
  <section className="panel" aria-label="Project settings">
    <PanelHead title="Canvas">
      <span className="muted">{`${project.width}x${project.height} @ ${project.fps}fps`}</span>
    </PanelHead>
    <div className="fields">
      <NumberField
        label="fps"
        value={project.fps}
        min={1}
        step={1}
        onChange={(v) => dispatch({ type: "meta.patch", patch: { fps: Math.max(1, Math.round(v)) } })}
      />
      <NumberField
        label="Width"
        value={project.width}
        min={2}
        step={1}
        onChange={(v) => dispatch({ type: "meta.patch", patch: { width: Math.max(2, Math.round(v)) } })}
      />
      <NumberField
        label="Height"
        value={project.height}
        min={2}
        step={1}
        onChange={(v) => dispatch({ type: "meta.patch", patch: { height: Math.max(2, Math.round(v)) } })}
      />
    </div>
  </section>
);
