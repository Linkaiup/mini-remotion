import type React from "react";
import { interpolate, useCurrentFrame } from "../core";
import type { EditorEffect } from "./types";

/** 特效叠加层 + 滤镜（相对片段局部帧，可随时间变化） */
export const useClipEffectStyle = (
  effect: EditorEffect | undefined,
  durationInFrames: number,
): { container: React.CSSProperties; overlay?: React.CSSProperties } => {
  const frame = useCurrentFrame();

  if (!effect || effect === "none") {
    return { container: {} };
  }

  switch (effect) {
    case "blur": {
      const amount = interpolate(frame, [0, 20], [8, 0], {
        extrapolateRight: "clamp",
      });
      return { container: { filter: `blur(${amount}px)` } };
    }
    case "grayscale":
      return { container: { filter: "grayscale(1)" } };
    case "vignette":
      return {
        container: {},
        overlay: {
          position: "absolute",
          inset: 0,
          pointerEvents: "none",
          background:
            "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.65) 100%)",
        },
      };
    case "zoomPulse": {
      const pulse = interpolate(
        frame % Math.min(30, durationInFrames),
        [0, 15, 30],
        [1, 1.06, 1],
        { extrapolateRight: "clamp" },
      );
      return {
        container: {
          transform: `scale(${pulse})`,
          transformOrigin: "center center",
        },
      };
    }
    default:
      return { container: {} };
  }
};

export const EFFECT_OPTIONS: { value: EditorEffect; label: string }[] = [
  { value: "none", label: "无" },
  { value: "blur", label: "模糊入场" },
  { value: "grayscale", label: "黑白" },
  { value: "vignette", label: "暗角" },
  { value: "zoomPulse", label: "呼吸缩放" },
];
