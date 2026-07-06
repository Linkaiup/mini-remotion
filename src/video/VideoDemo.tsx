import React from "react";
import { interpolate, staticFile, useCurrentFrame, Video } from "../core";

/**
 * 演示 <Video> 组件:底层视频铺满画布,上层叠加半透明标题。
 * 需先运行 npm run make-video 生成 public/sample.mp4。
 */
const FPS = 30;
const DURATION = 90;

export const videoDemoMeta = {
  width: 1280,
  height: 720,
  fps: FPS,
  durationInFrames: DURATION,
};

export const VideoDemo: React.FC = () => {
  const frame = useCurrentFrame();
  const titleOpacity = interpolate(frame, [0, 20, DURATION - 15, DURATION], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });

  return (
    <div style={{ position: "absolute", inset: 0, background: "#000" }}>
      <Video
        src={staticFile("sample.mp4")}
        style={{ width: "100%", height: "100%" }}
        volume={0}
        muted
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "system-ui",
          fontSize: 56,
          fontWeight: 800,
          color: "#f8fafc",
          textShadow: "0 4px 24px rgba(0,0,0,0.8)",
          opacity: titleOpacity,
        }}
      >
        Video Layer Demo
      </div>
    </div>
  );
};
