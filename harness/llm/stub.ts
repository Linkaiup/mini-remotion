import type { ChatMessage, LLMProvider } from "./types.js";

const extractTitle = (messages: ChatMessage[]): string => {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const raw = lastUser?.content ?? "Generated Video";
  const firstLine = raw.split("\n").find((l) => l.trim()) ?? raw;
  return firstLine.trim().slice(0, 40).replace(/`/g, "'");
};

export const createStubProvider = (): LLMProvider => ({
  name: "stub",
  complete: async (messages) => {
    const title = extractTitle(messages);
    return `\`\`\`tsx
import React from "react";
import { interpolate, spring, useCurrentFrame } from "../core";

export const meta = {
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 120,
};

export const VideoComposition: React.FC = () => {
  const frame = useCurrentFrame();
  const fade = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: "clamp" });
  const pop = spring({ frame, fps: meta.fps, config: { damping: 14 } });
  return (
    <div style={{
      position: "absolute", inset: 0,
      background: "radial-gradient(circle at 30% 20%, #1e3a8a, #0f172a 70%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, sans-serif", color: "#f1f5f9",
    }}>
      <div style={{
        opacity: fade, transform: \`scale(\${pop})\`, fontSize: 76, fontWeight: 800,
      }}>
        ${title}
      </div>
    </div>
  );
};
\`\`\``;
  },
});
