// 本文件由 video-agent 生成,请勿手改(下次运行会被覆盖)。
import React from "react";
import { useCurrentFrame, interpolate } from "../core";

export const meta = {
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 150,
};

export const VideoComposition: React.FC = () => {
  const frame = useCurrentFrame();

  const gradientOpacity = interpolate(frame, [0, 60], [0, 1], {
    extrapolateRight: "clamp",
  });

  const titleOpacity = interpolate(frame, [40, 80], [0, 1], {
    extrapolateRight: "clamp",
  });

  const subtitleOpacity = interpolate(frame, [60, 100], [0, 1], {
    extrapolateRight: "clamp",
  });

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        alignItems: "center",
        background: `linear-gradient(135deg, #0f2027 0%, #203a43 30%, #2c5364 60%, #00b4db 100%)`,
        opacity: gradientOpacity,
        fontFamily: "system-ui, sans-serif",
        overflow: "hidden",
      }}
    >
      <h1
        style={{
          fontSize: 80,
          fontWeight: 700,
          color: "#ffffff",
          margin: 0,
          opacity: titleOpacity,
          textShadow: "0 4px 16px rgba(0,0,0,0.4)",
          letterSpacing: "0.02em",
        }}
      >
        Blue Horizon
      </h1>
      <p
        style={{
          fontSize: 32,
          fontWeight: 400,
          color: "#e0f7ff",
          marginTop: 16,
          opacity: subtitleOpacity,
          textShadow: "0 2px 8px rgba(0,0,0,0.3)",
        }}
      >
        Welcome to the future
      </p>
    </div>
  );
};
