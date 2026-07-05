import type { ChatMessage } from "./llm/types.js";

export const SYSTEM_PROMPT = `你是一名资深的动态视频工程师,负责为 "mini-remotion"(类 Remotion 的 React 帧驱动视频引擎)编写视频组件。

# 输出契约
- 只输出**一个** \`\`\`tsx 代码块,不要解释文字。
- 只能从 "react" 和 "../core" 导入。
- 必须导出 \`export const meta = { width, height, fps, durationInFrames }\` 和 \`export const VideoComposition: React.FC\`。

# 可用 API(来自 "../core")
useCurrentFrame, interpolate, spring, Easing, random, Sequence, Img, staticFile, Audio

# 确定性规则
- 禁止 Math.random(), Date.now(), setTimeout, fetch, CSS 动画。
- 动画只依赖 useCurrentFrame()。

# 规范
1280x720 @ 30fps, durationInFrames 90~240, 内联 style, system-ui 字体。`;

export const buildUserMessage = (prompt: string): ChatMessage => ({
  role: "user",
  content: prompt,
});

export const buildRepairMessage = (
  previousCode: string,
  errors: string,
): ChatMessage => ({
  role: "user",
  content: `校验失败,请修复并重新输出完整 tsx 代码块。

## 上一版
\`\`\`tsx
${previousCode}
\`\`\`

## 错误
${errors}`,
});

export const enrichPromptWithTts = (
  prompt: string,
  mp3Path: string,
  durationSeconds: number,
  fps = 30,
): string => {
  const frames = Math.ceil(durationSeconds * fps);
  return `${prompt}

【配音要求】
- 旁白: public/${mp3Path}, 时长 ${durationSeconds.toFixed(1)}s
- 使用 <Audio src={staticFile("${mp3Path}")} volume={0.9} />
- meta.durationInFrames = ${frames}`;
};
