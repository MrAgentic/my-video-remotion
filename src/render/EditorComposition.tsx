import { Audio, Video } from "@remotion/media";
import { AbsoluteFill, Sequence } from "remotion";
import { mediaSrc } from "../editor/media-src";
import {
  clipDurationSec,
  EditProject,
  projectDurationInFrames,
  secToFrames,
} from "../editor/types";

/**
 * The single composition used for BOTH <Player> preview and CLI export.
 * All timing arrives in seconds and is converted to frames with project.fps,
 * so preview and render cannot diverge.
 */

const textStyle = (t: EditProject["textOverlays"][number]) =>
  ({
    position: "absolute",
    left: `${t.xPct}%`,
    top: `${t.yPct}%`,
    transform: "translate(-50%, -50%)",
    fontSize: t.fontSizePx,
    fontFamily: "sans-serif",
    color: t.color,
    background: t.backgroundColor || "transparent",
    fontWeight: t.bold ? 700 : 400,
    lineHeight: 1.2,
    margin: 0,
    padding: t.backgroundColor ? "0.15em 0.4em" : 0,
    whiteSpace: "pre-wrap",
    textAlign: "center",
  }) satisfies React.CSSProperties;

const TextLayer: React.FC<{ project: EditProject }> = ({ project }) => {
  return (
    <>
      {project.textOverlays.map((t) => {
        const from = secToFrames(t.startSec, project.fps);
        const durationInFrames = secToFrames(t.durationSec, project.fps);
        if (durationInFrames <= 0 || !t.text) {
          return null;
        }
        return (
          <Sequence key={t.id} from={from} durationInFrames={durationInFrames}>
            <AbsoluteFill>
              <div style={textStyle(t)}>{t.text}</div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};

const CaptionLayer: React.FC<{ project: EditProject }> = ({ project }) => {
  const style = project.captionStyle;
  return (
    <>
      {project.captions.map((c) => {
        const from = secToFrames(c.startSec, project.fps);
        const durationInFrames = secToFrames(c.endSec - c.startSec, project.fps);
        if (durationInFrames <= 0 || !c.text) {
          return null;
        }
        return (
          <Sequence key={c.id} from={from} durationInFrames={durationInFrames}>
            <AbsoluteFill
              style={{
                justifyContent: "flex-end",
                alignItems: "center",
                paddingBottom: style.bottomMarginPx,
              }}
            >
              <div
                style={{
                  position: "relative",
                  fontSize: style.fontSizePx,
                  fontFamily: "sans-serif",
                  color: style.color,
                  background: style.backgroundColor || "transparent",
                  fontWeight: 700,
                  margin: 0,
                  padding: "0.1em 0.4em",
                  whiteSpace: "pre-wrap",
                  textAlign: "center",
                  maxWidth: "85%",
                }}
              >
                {c.text}
              </div>
            </AbsoluteFill>
          </Sequence>
        );
      })}
    </>
  );
};

export const EditorComposition: React.FC<EditProject> = (project) => {
  let offsetSec = 0;
  return (
    <AbsoluteFill
      style={{
        backgroundColor: "#000",
        width: project.width,
        height: project.height,
      }}
    >
      {project.videoClips.map((clip) => {
        const start = offsetSec;
        offsetSec += clipDurationSec(clip);
        const durationInFrames = secToFrames(clipDurationSec(clip), project.fps);
        if (!clip.filename || durationInFrames <= 0) {
          return null;
        }
        return (
          <Video
            key={clip.id}
            src={mediaSrc(clip.filename)}
            from={secToFrames(start, project.fps)}
            durationInFrames={durationInFrames}
            trimBefore={secToFrames(clip.trimStartSec, project.fps)}
            volume={clip.volume}
            muted={clip.muted}
            objectFit="contain"
            style={{ position: "absolute", width: "100%", height: "100%" }}
          />
        );
      })}

      {project.audioClips.map((clip) => {
        const durationInFrames = secToFrames(clipDurationSec(clip), project.fps);
        if (!clip.filename || durationInFrames <= 0) {
          return null;
        }
        return (
          <Audio
            key={clip.id}
            src={mediaSrc(clip.filename)}
            from={secToFrames(clip.startSec, project.fps)}
            durationInFrames={durationInFrames}
            trimBefore={secToFrames(clip.trimStartSec, project.fps)}
            volume={clip.volume}
            muted={clip.muted}
          />
        );
      })}

      <CaptionLayer project={project} />
      <TextLayer project={project} />
    </AbsoluteFill>
  );
};

export const editorCalculateMetadata = ({ props }: { props: EditProject }) => {
  return {
    durationInFrames: projectDurationInFrames(props),
    fps: props.fps,
    width: props.width,
    height: props.height,
    props,
  };
};
