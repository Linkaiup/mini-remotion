import React from "react";
import {
  Audio,
  interpolate,
  random,
  spring,
  staticFile,
  useCurrentFrame,
  z,
  zColor,
} from "../core";

/**
 * 一个"纯代码"视频(不经过草稿层),演示数据层的完全能力 + props 驱动。
 * 画面完全由 frame + props 计算得出 —— 同一帧同一 props 永远相同。
 */
const FPS = 30;

// props 的 zod schema:既能运行时校验,又能在 Studio 自动生成表单
export const codeDemoSchema = z.object({
  titleText: z.string(),
  titleColor: zColor(),
  ballColor: zColor(),
  backgroundColor: zColor(),
  starCount: z.number().min(0).max(120),
  showBall: z.boolean(),
});

export type CodeDemoProps = z.infer<typeof codeDemoSchema>;

export const codeDemoDefaultProps: CodeDemoProps = {
  titleText: "Pure Code Video",
  titleColor: "#f8fafc",
  ballColor: "#0284c7",
  backgroundColor: "#0f172a",
  starCount: 40,
  showBall: true,
};

export const CodeDemo: React.FC<CodeDemoProps> = ({
  titleText,
  titleColor,
  ballColor,
  backgroundColor,
  starCount,
  showBall,
}) => {
  const frame = useCurrentFrame();

  const bounce = Math.abs(Math.sin((frame / FPS) * Math.PI * 1.2));
  const ballY = interpolate(bounce, [0, 1], [420, 120]);
  const ballX = interpolate(frame, [0, 150], [140, 1040], {
    extrapolateRight: "clamp",
  });

  const titleScale = spring({ frame, fps: FPS, config: { damping: 8 } });

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: backgroundColor,
        overflow: "hidden",
        fontFamily: "system-ui, -apple-system, sans-serif",
      }}
    >
      <Audio src={staticFile("audio.mp3")} volume={0.4} />

      {/* 确定性随机星点背景 */}
      {Array.from({ length: Math.round(starCount) }).map((_, i) => {
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
          color: titleColor,
          transform: `scale(${titleScale})`,
          transformOrigin: "left center",
        }}
      >
        {titleText}
      </div>

      {showBall ? (
        <div
          style={{
            position: "absolute",
            left: ballX,
            top: ballY,
            width: 100,
            height: 100,
            borderRadius: 100,
            background: `radial-gradient(circle at 35% 35%, #7dd3fc, ${ballColor})`,
            boxShadow: "0 20px 40px rgba(2,132,199,0.4)",
          }}
        />
      ) : null}
    </div>
  );
};
