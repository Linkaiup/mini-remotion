import React from "react";
import {
  Audio,
  interpolate,
  staticFile,
  useCurrentFrame,
} from "../core";

const FPS = 30;
const DURATION = 120;

export const audioFadeDemoMeta = {
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};

/**
 * 演示 P4-d 音量曲线:淡入 → 保持 → 淡出。
 * 需 npm run make-audio 生成 public/audio.mp3。
 */
export const AudioFadeDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const labelOpacity = interpolate(frame, [0, 20, DURATION - 20, DURATION], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(160deg, #0f172a, #1e3a5f)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "system-ui",
      }}
    >
      <Audio
        src={staticFile("audio.mp3")}
        volume={(f) =>
          interpolate(f, [0, 24, 96, 120], [0, 0.85, 0.85, 0], {
            extrapolateLeft: "clamp",
            extrapolateRight: "clamp",
          })
        }
      />
      <div
        style={{
          fontSize: 48,
          fontWeight: 800,
          color: "#e2e8f0",
          opacity: labelOpacity,
          textAlign: "center",
          lineHeight: 1.4,
        }}
      >
        Audio Fade Demo
        <div style={{ fontSize: 22, fontWeight: 500, marginTop: 12, opacity: 0.8 }}>
          volume(frame) → FFmpeg preprocess
        </div>
      </div>
    </div>
  );
};
