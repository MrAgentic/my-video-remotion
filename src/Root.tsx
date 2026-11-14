import { Composition } from "remotion";
import { createEmptyProject, projectDurationInFrames } from "./editor/types";
import {
  EditorComposition,
  editorCalculateMetadata,
} from "./render/EditorComposition";
import { MyComposition } from "./Composition";

const defaultProject = createEmptyProject();

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <MyComposition />
      <Composition
        id="Editor"
        component={EditorComposition}
        durationInFrames={projectDurationInFrames(defaultProject)}
        fps={defaultProject.fps}
        width={defaultProject.width}
        height={defaultProject.height}
        defaultProps={defaultProject}
        calculateMetadata={editorCalculateMetadata}
      />
    </>
  );
};
