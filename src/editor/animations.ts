import type React from "react";
import { Easing, interpolate, spring } from "../core";
import type { EditorAnimation } from "./types";

/**
 * 将片段 animation 字段转为 CSS 样式（相对 Sequence 内局部帧）。
 */
export const useClipAnimationStyle = (
  animation: EditorAnimation | undefined,
  fps: number,
  frame: number,
): React.CSSProperties => {
  switch (animation) {
    case "fadeIn": {
      const opacity = interpolate(frame, [0, 15], [0, 1], {
        easing: Easing.easeOut,
        extrapolateRight: "clamp",
      });
      return { opacity };
    }
    case "slideInLeft": {
      const progress = spring({ frame, fps, config: { damping: 14 } });
      const translateX = interpolate(progress, [0, 1], [-80, 0]);
      return { opacity: progress, transform: `translateX(${translateX}px)` };
    }
    case "slideInRight": {
      const progress = spring({ frame, fps, config: { damping: 14 } });
      const translateX = interpolate(progress, [0, 1], [80, 0]);
      return { opacity: progress, transform: `translateX(${translateX}px)` };
    }
    case "springPop": {
      const scale = spring({ frame, fps, config: { damping: 9 } });
      return {
        opacity: interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }),
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      };
    }
    case "bounceIn": {
      const scale = spring({ frame, fps, config: { damping: 7, stiffness: 180 } });
      return {
        opacity: interpolate(frame, [0, 10], [0, 1], { extrapolateRight: "clamp" }),
        transform: `scale(${scale})`,
        transformOrigin: "center center",
      };
    }
    case "none":
    default:
      return {};
  }
};

export const ANIMATION_OPTIONS: { value: EditorAnimation; label: string }[] = [
  { value: "none", label: "无" },
  { value: "fadeIn", label: "淡入" },
  { value: "slideInLeft", label: "左滑入" },
  { value: "slideInRight", label: "右滑入" },
  { value: "springPop", label: "弹簧放大" },
  { value: "bounceIn", label: "弹入" },
];
