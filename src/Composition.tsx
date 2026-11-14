import { Video } from "@remotion/media";
import {
  CalculateMetadataFunction,
  Composition,
  staticFile,
  Track,
} from "remotion";

type Props = {};

const calculateMetadata: CalculateMetadataFunction<Props> = () => {
  return {};
};

export const MyComposition = () => {
  return (
    <Composition
      id="MyComp"
      component={MyComponent}
      durationInFrames={60}
      fps={30}
      width={1280}
      height={720}
      calculateMetadata={calculateMetadata}
    />
  );
};

export const MyComponent: React.FC<Props> = () => {
  return (
    <>
      <Video
        src={staticFile("cesdk-2026-11-14T13_01_05.887Z.mp4")}
        durationInFrames={602.4}
        from={12}
        style={{
          position: "absolute",
          translate: "-320px -180px",
          width: 1920,
          height: 1080
        }}
      />
      <Video
        src={staticFile("test.mp4")}
        durationInFrames={600}
        style={{
          position: "absolute",
          translate: "-17.8px -44.1px",
          width: 1108,
          height: 832
        }}
      />
    </>
  );
};
