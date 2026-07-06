import type { ChatMessage, LLMProvider } from "./types.js";

const extractTitle = (messages: ChatMessage[]): string => {
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const raw = lastUser?.content ?? "Generated Video";
  const firstLine = raw.split("\n").find((l) => l.trim()) ?? raw;
  return firstLine.trim().slice(0, 40).replace(/`/g, "'");
};

type StubTimeline = {
  durationInFrames: number;
  fps: number;
  width: number;
  height: number;
  scenes: { id?: string; startFrame: number; endFrame: number; label: string }[];
  assets?: { path: string; sceneId: string }[];
};

const parseTimelineFromMessages = (
  messages: ChatMessage[],
): StubTimeline | null => {
  for (const msg of [...messages].reverse()) {
    const m = msg.content.match(/```json\s*\n([\s\S]*?)```/);
    if (!m) continue;
    try {
      const raw = JSON.parse(m[1]) as StubTimeline;
      if (raw.scenes?.length) return raw;
    } catch {
      /* try next */
    }
  }
  return null;
};

const sceneBlock = (
  scene: { startFrame: number; endFrame: number; label: string },
  title: string,
  assetPath?: string,
): string => {
  const dur = scene.endFrame - scene.startFrame;
  const label = scene.label.replace(/"/g, "'");
  if (assetPath) {
    return `<Sequence from={${scene.startFrame}} durationInFrames={${dur}}>
        <Img src={staticFile("${assetPath}")} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 48, fontFamily: "system-ui", color: "#fff", fontSize: 48, fontWeight: 700, textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>${label}</div>
      </Sequence>`;
  }
  return `<Sequence from={${scene.startFrame}} durationInFrames={${dur}}>
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "system-ui", color: "#f1f5f9", fontSize: 56, fontWeight: 800 }}>${scene.startFrame === 0 ? title : label}</div>
      </Sequence>`;
};

export const createStubProvider = (): LLMProvider => ({
  name: "stub",
  complete: async (messages) => {
    const title = extractTitle(messages);
    const tl = parseTimelineFromMessages(messages);

    if (tl && tl.scenes.length > 0) {
      const imports = tl.assets?.length
        ? 'import { Img, Sequence, staticFile, useCurrentFrame } from "../core";'
        : 'import { Sequence, useCurrentFrame } from "../core";';
      const blocks = tl.scenes
        .map((s, i) => {
          const path = tl.assets?.find(
            (a) => a.sceneId === s.id || a.sceneId === `scene-${i}`,
          )?.path;
          return sceneBlock(s, title, path);
        })
        .join("\n      ");

      return `\`\`\`tsx
import React from "react";
${imports}

export const meta = {
  width: ${tl.width},
  height: ${tl.height},
  fps: ${tl.fps},
  durationInFrames: ${tl.durationInFrames},
};

export const VideoComposition: React.FC = () => {
  useCurrentFrame();
  return (
    <div style={{ position: "absolute", inset: 0, background: "#0f172a" }}>
      ${blocks}
    </div>
  );
};
\`\`\``;
    }

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
