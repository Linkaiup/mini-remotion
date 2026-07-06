// 本文件由 video-agent 生成,请勿手改(下次运行会被覆盖)。
import React from "react";
import { Sequence, useCurrentFrame } from "../core";

export const meta = {
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 120,
};

export const VideoComposition: React.FC = () => {
  useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0f172a" }}>
      <Sequence from={0} durationInFrames={40}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#f1f5f9", fontSize: 56, fontWeight: 800 }}>## 用户需求</div>
      </Sequence>
      <Sequence from={40} durationInFrames={40}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#f1f5f9", fontSize: 56, fontWeight: 800 }}>主体</div>
      </Sequence>
      <Sequence from={80} durationInFrames={40}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#f1f5f9", fontSize: 56, fontWeight: 800 }}>结尾</div>
      </Sequence>
    </div>
  );
};
