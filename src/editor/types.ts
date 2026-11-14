// Shared, JSON-serializable project schema.
// Consumed by BOTH the browser editor UI and the render composition.
//
// UNITS: every time field is in SECONDS (float). The composition converts to
// frames with project.fps via secToFrames(). Sizes are pixels, positions are
// percentages of the composition (0-100) so the layout is resolution agnostic.

export type VideoClip = {
  id: string;
  /** Plain filename inside public/, e.g. "test.mp4" */
  filename: string;
  /** Source in-point, seconds */
  trimStartSec: number;
  /** Source out-point, seconds (absolute, must be > trimStartSec) */
  trimEndSec: number;
  /** 0..1 */
  volume: number;
  muted: boolean;
};

export type AudioClip = {
  id: string;
  filename: string;
  /** Timeline offset where the clip starts, seconds */
  startSec: number;
  /** Source in-point, seconds */
  trimStartSec: number;
  /** Source out-point, seconds (absolute) */
  trimEndSec: number;
  volume: number;
  muted: boolean;
};

export type TextOverlay = {
  id: string;
  text: string;
  /** Timeline start, seconds */
  startSec: number;
  /** How long it stays on screen, seconds */
  durationSec: number;
  /** 0..100 percent of composition width/height (element centre) */
  xPct: number;
  yPct: number;
  fontSizePx: number;
  color: string;
  /** CSS colour, or null/"" for transparent */
  backgroundColor: string;
  bold: boolean;
};

export type CaptionCue = {
  id: string;
  text: string;
  /** seconds */
  startSec: number;
  /** seconds */
  endSec: number;
};

export type CaptionStyle = {
  fontSizePx: number;
  color: string;
  backgroundColor: string;
  /** px from the bottom of the frame */
  bottomMarginPx: number;
};

export type EditProject = {
  version: 1;
  fps: number;
  width: number;
  height: number;
  videoClips: VideoClip[];
  audioClips: AudioClip[];
  textOverlays: TextOverlay[];
  captions: CaptionCue[];
  captionStyle: CaptionStyle;
};

export const DEFAULT_CAPTION_STYLE: CaptionStyle = {
  fontSizePx: 42,
  color: "#ffffff",
  backgroundColor: "rgba(0,0,0,0.65)",
  bottomMarginPx: 60,
};

export const createEmptyProject = (): EditProject => ({
  version: 1,
  fps: 30,
  width: 1280,
  height: 720,
  videoClips: [],
  audioClips: [],
  textOverlays: [],
  captions: [],
  captionStyle: { ...DEFAULT_CAPTION_STYLE },
});

let idCounter = 0;

// Deliberately not Math.random(): Remotion's lint rule requires frame-stable
// values, and ids are only ever minted by the UI when the user adds something.
export const newId = (): string => {
  idCounter += 1;
  return `id-${Date.now().toString(36)}-${idCounter.toString(36)}`;
};

export const secToFrames = (sec: number, fps: number): number =>
  Math.max(0, Math.round(sec * fps));

export const framesToSec = (frames: number, fps: number): number => frames / fps;

export const clipDurationSec = (clip: VideoClip | AudioClip): number =>
  Math.max(0, clip.trimEndSec - clip.trimStartSec);

/** Video clips play back-to-back, so the track length is the sum of clip lengths. */
export const videoTrackDurationSec = (project: EditProject): number =>
  project.videoClips.reduce((acc, c) => acc + clipDurationSec(c), 0);

/** Timeline offset of a clip, in seconds, given the sequential video track. */
export const videoClipStartSec = (
  project: EditProject,
  index: number,
): number =>
  project.videoClips
    .slice(0, index)
    .reduce((acc, c) => acc + clipDurationSec(c), 0);

/** Total project duration = the latest ending thing on the timeline. */
export const projectDurationSec = (project: EditProject): number => {
  const ends: number[] = [videoTrackDurationSec(project)];
  for (const a of project.audioClips) {
    ends.push(a.startSec + clipDurationSec(a));
  }
  for (const t of project.textOverlays) {
    ends.push(t.startSec + t.durationSec);
  }
  for (const c of project.captions) {
    ends.push(c.endSec);
  }
  return Math.max(0, ...ends);
};

export const projectDurationInFrames = (project: EditProject): number => {
  const frames = secToFrames(projectDurationSec(project), project.fps);
  // Never hand the Player a 1-frame composition: it divides by
  // (durationInFrames - 1) internally and emits NaN styles. An empty timeline
  // is therefore one second of black.
  return Math.max(Math.round(project.fps), frames);
};

const isNum = (v: unknown, fallback: number): number =>
  typeof v === "number" && Number.isFinite(v) ? v : fallback;

const isStr = (v: unknown, fallback: string): string =>
  typeof v === "string" ? v : fallback;

const isBool = (v: unknown, fallback: boolean): boolean =>
  typeof v === "boolean" ? v : fallback;

/** Defensive normaliser for localStorage / imported JSON / render props. */
export const normalizeProject = (raw: unknown): EditProject => {
  const base = createEmptyProject();
  if (!raw || typeof raw !== "object") {
    return base;
  }
  const p = raw as Partial<EditProject>;
  return {
    version: 1,
    fps: isNum(p.fps, 30),
    width: isNum(p.width, 1280),
    height: isNum(p.height, 720),
    videoClips: Array.isArray(p.videoClips)
      ? p.videoClips.map((c) => ({
          id: isStr(c.id, newId()),
          filename: isStr(c.filename, ""),
          trimStartSec: isNum(c.trimStartSec, 0),
          trimEndSec: isNum(c.trimEndSec, 0),
          volume: isNum(c.volume, 1),
          muted: isBool(c.muted, false),
        }))
      : [],
    audioClips: Array.isArray(p.audioClips)
      ? p.audioClips.map((c) => ({
          id: isStr(c.id, newId()),
          filename: isStr(c.filename, ""),
          startSec: isNum(c.startSec, 0),
          trimStartSec: isNum(c.trimStartSec, 0),
          trimEndSec: isNum(c.trimEndSec, 0),
          volume: isNum(c.volume, 1),
          muted: isBool(c.muted, false),
        }))
      : [],
    textOverlays: Array.isArray(p.textOverlays)
      ? p.textOverlays.map((t) => ({
          id: isStr(t.id, newId()),
          text: isStr(t.text, ""),
          startSec: isNum(t.startSec, 0),
          durationSec: isNum(t.durationSec, 3),
          xPct: isNum(t.xPct, 50),
          yPct: isNum(t.yPct, 15),
          fontSizePx: isNum(t.fontSizePx, 60),
          color: isStr(t.color, "#ffffff"),
          backgroundColor: isStr(t.backgroundColor, ""),
          bold: isBool(t.bold, true),
        }))
      : [],
    captions: Array.isArray(p.captions)
      ? p.captions.map((c) => ({
          id: isStr(c.id, newId()),
          text: isStr(c.text, ""),
          startSec: isNum(c.startSec, 0),
          endSec: isNum(c.endSec, 0),
        }))
      : [],
    captionStyle: {
      fontSizePx: isNum(p.captionStyle?.fontSizePx, 42),
      color: isStr(p.captionStyle?.color, "#ffffff"),
      backgroundColor: isStr(
        p.captionStyle?.backgroundColor,
        DEFAULT_CAPTION_STYLE.backgroundColor,
      ),
      bottomMarginPx: isNum(p.captionStyle?.bottomMarginPx, 60),
    },
  };
};
