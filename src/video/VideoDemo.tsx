import React from "react";
import {
  interpolate,
  OffthreadVideo,
  staticFile,
  useCurrentFrame,
} from "../core";

/**
 * 演示 <OffthreadVideo>:预览走 <Video>,导出走 FFmpeg /proxy 抽帧 + 视频音轨混流(P4-c)。
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
      <OffthreadVideo
        src={staticFile("sample.mp4")}
        style={{ width: "100%", height: "100%" }}
        volume={1}
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
