import React, { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { EditorComposition } from "../render/EditorComposition";
import {
  createEmptyProject,
  clipDurationSec,
  EditProject,
  framesToSec,
  normalizeProject,
  projectDurationInFrames,
  projectDurationSec,
  VideoClip,
} from "./types";
import {
  loadStoredProject,
  makeAudioClip,
  makeVideoClip,
  reducer,
  saveProject,
} from "./state";
import { MediaInfo } from "./api";
import { MediaPanel } from "./panels/MediaPanel";
import { AudioTrackPanel, ProjectSettings, VideoTrackPanel } from "./panels/TracksPanel";
import { CaptionsPanel, TextPanel } from "./panels/OverlaysPanel";
import { ExportPanel, ProjectPanel } from "./panels/ProjectPanel";
import "./editor.css";

const TabButtons: React.FC<{
  tabs: string[];
  active: string;
  onSelect: (t: string) => void;
}> = ({ tabs, active, onSelect }) => (
  <div className="tabs">
    {tabs.map((t) => (
      <button
        key={t}
        type="button"
        className={t === active ? "tab active" : "tab"}
        onClick={() => onSelect(t)}
      >
        {t}
      </button>
    ))}
  </div>
);

const Timeline: React.FC<{
  project: EditProject;
  currentFrame: number;
  onSeek: (frame: number) => void;
  onSelectClip: (clip: VideoClip) => void;
  selectedVideoId: string | null;
}> = ({ project, currentFrame, onSeek, onSelectClip, selectedVideoId }) => {
  const totalSec = projectDurationSec(project) || 1;
  const px = (sec: number) => `${(sec / totalSec) * 100}%`;
  const track = (children: React.ReactNode, label: string) => (
    <div className="tl-row">
      <span className="tl-label">{label}</span>
      <div className="tl-track">{children}</div>
    </div>
  );

  return (
    <div
      className="timeline"
      onClick={(e) => {
        const box = (e.currentTarget.querySelector(".tl-track") as HTMLElement | null)?.getBoundingClientRect();
        if (!box) return;
        const ratio = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
        onSeek(Math.round(ratio * projectDurationInFrames(project)));
      }}
      role="presentation"
    >
      <div className="tl-head">
        <span>
          {framesToSec(currentFrame, project.fps).toFixed(2)}s / {totalSec.toFixed(2)}s
        </span>
        <span className="muted">
          {project.videoClips.length} clip(s) · {project.audioClips.length} audio ·{" "}
          {project.textOverlays.length} text · {project.captions.length} cues
        </span>
      </div>
      {track(
        <>
          {(() => {
            let acc = 0;
            return project.videoClips.map((clip, i) => {
              const left = acc;
              acc += clipDurationSec(clip);
              return (
                <button
                  type="button"
                  key={clip.id}
                  className={clip.id === selectedVideoId ? "seg video selected" : "seg video"}
                  style={{ left: px(left), width: px(clipDurationSec(clip)) }}
                  title={clip.filename}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectClip(clip);
                  }}
                >
                  {i + 1}
                </button>
              );
            });
          })()}
        </>,
        "Video",
      )}
      {track(
        project.audioClips.map((clip) => (
          <div
            key={clip.id}
            className="seg audio"
            style={{ left: px(clip.startSec), width: px(clipDurationSec(clip)) }}
            title={clip.filename}
          />
        )),
        "Audio",
      )}
      {track(
        project.textOverlays.map((t) => (
          <div
            key={t.id}
            className="seg text"
            style={{ left: px(t.startSec), width: px(t.durationSec) }}
            title={t.text}
          />
        )),
        "Text",
      )}
      {track(
        project.captions.map((c) => (
          <div
            key={c.id}
            className="seg caption"
            style={{ left: px(c.startSec), width: px(Math.max(0.05, c.endSec - c.startSec)) }}
            title={c.text}
          />
        )),
        "Captions",
      )}
      <div
        className="playhead"
        style={{
          left: `calc(var(--tl-label) + (100% - var(--tl-label)) * ${
            currentFrame / Math.max(1, projectDurationInFrames(project))
          })`,
        }}
      />
    </div>
  );
};

const initialProject = (): EditProject => {
  // ?project=<urlencoded JSON> seeds the project on load - lets automated
  // browser checks (and screenshots) start from a known state.
  const fromUrl = new URLSearchParams(location.search).get("project");
  if (fromUrl) {
    try {
      return normalizeProject(JSON.parse(fromUrl));
    } catch {
      // fall through to storage
    }
  }
  const stored = loadStoredProject();
  return stored.videoClips.length || stored.captions.length ? stored : createEmptyProject();
};

export const App: React.FC = () => {
  const [project, dispatch] = useReducer(reducer, undefined, initialProject);
  const [tab, setTab] = useState("Media");
  const [selectedVideoId, setSelectedVideoId] = useState<string | null>(null);
  const [currentFrame, setCurrentFrame] = useState(0);
  const playerRef = useRef<PlayerRef | null>(null);
  const lastSaved = useRef<string>("");

  useEffect(() => {
    const json = JSON.stringify(project);
    if (json === lastSaved.current) return;
    lastSaved.current = json;
    const t = window.setTimeout(() => saveProject(project), 250);
    return () => window.clearTimeout(t);
  }, [project]);

  const onPlayerFrame = useCallback((e: { detail: { frame: number } }) => {
    setCurrentFrame(e.detail.frame);
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    if (!player) return;
    player.addEventListener("frameupdate", onPlayerFrame);
    player.addEventListener("seeked", onPlayerFrame);
    return () => {
      player.removeEventListener("frameupdate", onPlayerFrame);
      player.removeEventListener("seeked", onPlayerFrame);
    };
  }, [onPlayerFrame]);

  const durationInFrames = useMemo(() => projectDurationInFrames(project), [project]);

  const addMedia = (m: MediaInfo) => {
    const dur = m.durationSec && m.durationSec > 0 ? m.durationSec : 5;
    if (m.kind === "video") {
      const clip = makeVideoClip(m.filename, dur);
      dispatch({ type: "video.add", clip });
      setSelectedVideoId(clip.id);
      setTab("Video");
    } else {
      dispatch({
        type: "audio.add",
        clip: makeAudioClip(m.filename, dur, projectDurationSec(project)),
      });
      setTab("Audio");
    }
  };

  const seek = (frame: number) => {
    setCurrentFrame(frame);
    playerRef.current?.seekTo(frame);
  };

  const nudge = (deltaFrames: number) => {
    const player = playerRef.current;
    if (!player) return;
    const target = Math.min(
      durationInFrames - 1,
      Math.max(0, player.getCurrentFrame() + deltaFrames),
    );
    seek(target);
  };

  return (
    <div className="app">
      <header className="topbar">
        <strong>Video Editor</strong>
        <span className="muted">{`${project.width}x${project.height} · ${project.fps}fps · ${durationInFrames} frames`}</span>
        <div className="btns">
          <button type="button" onClick={() => nudge(-project.fps)}>−1s</button>
          <button type="button" onClick={() => playerRef.current?.toggle()}>Play/Pause</button>
          <button type="button" onClick={() => nudge(project.fps)}>+1s</button>
        </div>
      </header>

      <main className="main">
        <aside className="left">
          <TabButtons
            tabs={["Media", "Video", "Audio", "Text", "Captions", "Output"]}
            active={tab}
            onSelect={setTab}
          />
          <div className="tab-body">
            {tab === "Media" ? <MediaPanel onAdd={addMedia} /> : null}
            {tab === "Video" ? (
              <VideoTrackPanel
                project={project}
                dispatch={dispatch}
                selectedVideoId={selectedVideoId}
                onSelectVideo={setSelectedVideoId}
              />
            ) : null}
            {tab === "Audio" ? (
              <>
                <AudioTrackPanel
                  project={project}
                  dispatch={dispatch}
                  onAddAudio={() => setTab("Media")}
                />
                <ProjectSettings project={project} dispatch={dispatch} />
              </>
            ) : null}
            {tab === "Text" ? <TextPanel project={project} dispatch={dispatch} /> : null}
            {tab === "Captions" ? (
              <CaptionsPanel project={project} dispatch={dispatch} />
            ) : null}
            {tab === "Output" ? (
              <>
                <ExportPanel project={project} />
                <ProjectPanel
                  project={project}
                  onReplace={(p) => {
                    dispatch({ type: "load", project: p });
                    setSelectedVideoId(p.videoClips[0]?.id ?? null);
                  }}
                />
              </>
            ) : null}
          </div>
        </aside>

        <section className="right">
          <div className="preview">
            <Player
              ref={playerRef}
              component={EditorComposition}
              inputProps={project}
              durationInFrames={durationInFrames}
              fps={project.fps}
              compositionWidth={project.width}
              compositionHeight={project.height}
              controls
              clickToPlay
              loop
              style={{ width: "100%", height: "100%" }}
            />
          </div>
          <Timeline
            project={project}
            currentFrame={currentFrame}
            onSeek={seek}
            selectedVideoId={selectedVideoId}
            onSelectClip={(clip) => {
              setSelectedVideoId(clip.id);
              setTab("Video");
            }}
          />
        </section>
      </main>
    </div>
  );
};
