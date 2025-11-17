/* Ken Burns effect component for Remotion
   - Applies smooth zoom and pan animation to images
   - Works with both data: URLs and file:// paths
   - Configurable animation direction and intensity
*/

import { Img, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import React from "react";

export interface KenBurnsImageProps {
  src: string;
  durationInFrames: number;
  startFrame?: number;
  direction?: "zoom-in" | "zoom-out" | "pan-right" | "pan-left";
  intensity?: number;
}

export const KenBurnsImage: React.FC<KenBurnsImageProps> = ({
  src,
  durationInFrames,
  startFrame = 0,
  direction = "zoom-in",
  intensity = 1.2,
}) => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();

  // Calculate progress (0 to 1) based on frame position within this clip
  const relativeFrame = frame - startFrame;
  const progress = interpolate(relativeFrame, [0, durationInFrames], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  let scale = 1;
  let translateX = 0;
  let translateY = 0;

  switch (direction) {
    case "zoom-in":
      scale = interpolate(progress, [0, 1], [1, intensity]);
      break;

    case "zoom-out":
      scale = interpolate(progress, [0, 1], [intensity, 1]);
      break;

    case "pan-right":
      scale = interpolate(progress, [0, 1], [1, intensity]);
      translateX = interpolate(progress, [0, 1], [0, -10]);
      break;

    case "pan-left":
      scale = interpolate(progress, [0, 1], [1, intensity]);
      translateX = interpolate(progress, [0, 1], [0, 10]);
      break;
  }

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        overflow: "hidden",
        position: "relative",
      }}
    >
      <Img
        src={src}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: `scale(${scale}) translate(${translateX}%, ${translateY}%)`,
          transformOrigin: "center center",
        }}
      />
    </div>
  );
};
