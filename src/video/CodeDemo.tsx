import React from "react";
import { interpolate, random, spring, useCurrentFrame } from "../core";

/**
 * 一个"纯代码"视频(不经过草稿层),演示数据层的完全能力。
 * 画面完全由 frame 计算得出 —— 同一帧永远相同,因此可 seek / 并发渲染。
 */
const FPS = 30;

export const CodeDemo: React.FC = () => {
  const frame = useCurrentFrame();

  // 弹跳的小球
  const bounce = Math.abs(Math.sin((frame / FPS) * Math.PI * 1.2));
  const ballY = interpolate(bounce, [0, 1], [420, 120]);
  const ballX = interpolate(frame, [0, 150], [140, 1040], {
    extrapolateRight: "clamp",
  });

  // 标题弹入
  const titleScale = spring({ frame, fps: FPS, config: { damping: 8 } });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "#0f172a",
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      {/* 确定性随机星点背景 */}
      {Array.from({ length: 40 }).map((_, i) => {
        const x = random(`x-${i}`) * 1280;
        const y = random(`y-${i}`) * 720;
        const twinkle = interpolate(
          Math.sin((frame / FPS) * 3 + i),
          [-1, 1],
          [0.2, 0.9],
        );
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 3,
              height: 3,
              borderRadius: 3,
              background: "#e2e8f0",
              opacity: twinkle,
            }}
          />
        );
      })}

      <div
        style={{
          position: "absolute",
          left: 120,
          top: 60,
          fontSize: 64,
          fontWeight: 800,
          color: "#f8fafc",
          transform: `scale(${titleScale})`,
          transformOrigin: "left center",
        }}
      >
        Pure Code Video
      </div>

      <div
        style={{
          position: "absolute",
          left: ballX,
          top: ballY,
          width: 100,
          height: 100,
          borderRadius: 100,
          background: "radial-gradient(circle at 35% 35%, #7dd3fc, #0284c7)",
          boxShadow: "0 20px 40px rgba(2,132,199,0.4)",
        }}
      />
    </div>
  );
};
