import {
  AudioClip,
  CaptionCue,
  CaptionStyle,
  createEmptyProject,
  EditProject,
  newId,
  normalizeProject,
  TextOverlay,
  VideoClip,
} from "./types";

export type Action =
  | { type: "load"; project: EditProject }
  | { type: "meta.patch"; patch: Partial<Pick<EditProject, "fps" | "width" | "height">> }
  | { type: "video.add"; clip: VideoClip }
  | { type: "video.patch"; id: string; patch: Partial<VideoClip> }
  | { type: "video.delete"; id: string }
  | { type: "video.move"; id: string; delta: number }
  | { type: "audio.add"; clip: AudioClip }
  | { type: "audio.patch"; id: string; patch: Partial<AudioClip> }
  | { type: "audio.delete"; id: string }
  | { type: "text.add"; item: TextOverlay }
  | { type: "text.patch"; id: string; patch: Partial<TextOverlay> }
  | { type: "text.delete"; id: string }
  | { type: "captions.set"; captions: CaptionCue[] }
  | { type: "caption.add"; item: CaptionCue }
  | { type: "caption.patch"; id: string; patch: Partial<CaptionCue> }
  | { type: "caption.delete"; id: string }
  | { type: "captionStyle.patch"; patch: Partial<CaptionStyle> };

const patchById = <T extends { id: string }>(list: T[], id: string, patch: Partial<T>): T[] =>
  list.map((item) => (item.id === id ? { ...item, ...patch } : item));

const deleteById = <T extends { id: string }>(list: T[], id: string): T[] =>
  list.filter((item) => item.id !== id);

const moveById = <T extends { id: string }>(list: T[], id: string, delta: number): T[] => {
  const from = list.findIndex((item) => item.id === id);
  if (from < 0) return list;
  const to = Math.min(list.length - 1, Math.max(0, from + delta));
  if (to === from) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const reducer = (state: EditProject, action: Action): EditProject => {
  switch (action.type) {
    case "load":
      return normalizeProject(action.project);
    case "meta.patch":
      return { ...state, ...action.patch };
    case "video.add":
      return { ...state, videoClips: [...state.videoClips, action.clip] };
    case "video.patch":
      return { ...state, videoClips: patchById(state.videoClips, action.id, action.patch) };
    case "video.delete":
      return { ...state, videoClips: deleteById(state.videoClips, action.id) };
    case "video.move":
      return { ...state, videoClips: moveById(state.videoClips, action.id, action.delta) };
    case "audio.add":
      return { ...state, audioClips: [...state.audioClips, action.clip] };
    case "audio.patch":
      return { ...state, audioClips: patchById(state.audioClips, action.id, action.patch) };
    case "audio.delete":
      return { ...state, audioClips: deleteById(state.audioClips, action.id) };
    case "text.add":
      return { ...state, textOverlays: [...state.textOverlays, action.item] };
    case "text.patch":
      return { ...state, textOverlays: patchById(state.textOverlays, action.id, action.patch) };
    case "text.delete":
      return { ...state, textOverlays: deleteById(state.textOverlays, action.id) };
    case "captions.set":
      return { ...state, captions: action.captions };
    case "caption.add":
      return { ...state, captions: [...state.captions, action.item] };
    case "caption.patch":
      return { ...state, captions: patchById(state.captions, action.id, action.patch) };
    case "caption.delete":
      return { ...state, captions: deleteById(state.captions, action.id) };
    case "captionStyle.patch":
      return { ...state, captionStyle: { ...state.captionStyle, ...action.patch } };
    default:
      return state;
  }
};

export const STORAGE_KEY = "rd-video-editor-project-v1";

export const loadStoredProject = (): EditProject => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? normalizeProject(JSON.parse(raw)) : createEmptyProject();
  } catch {
    return createEmptyProject();
  }
};

export const saveProject = (project: EditProject): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
  } catch {
    // storage full or unavailable - the in-memory project still works.
  }
};

// --- factories -------------------------------------------------------------

export const makeVideoClip = (filename: string, durationSec: number): VideoClip => ({
  id: newId(),
  filename,
  trimStartSec: 0,
  trimEndSec: Math.max(0.1, durationSec),
  volume: 1,
  muted: false,
});

export const makeAudioClip = (filename: string, durationSec: number, startSec: number): AudioClip => ({
  id: newId(),
  filename,
  startSec,
  trimStartSec: 0,
  trimEndSec: Math.max(0.1, durationSec),
  volume: 1,
  muted: false,
});

export const makeTextOverlay = (startSec: number): TextOverlay => ({
  id: newId(),
  text: "New text",
  startSec,
  durationSec: 3,
  xPct: 50,
  yPct: 15,
  fontSizePx: 64,
  color: "#ffffff",
  backgroundColor: "",
  bold: true,
});

export const makeCaptionCue = (startSec: number): CaptionCue => ({
  id: newId(),
  text: "",
  startSec,
  endSec: startSec + 2,
});
