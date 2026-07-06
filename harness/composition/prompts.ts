import type { ChatMessage } from "../llm/types.js";
import type { VideoTimeline } from "../timeline/types.js";

export const COMPOSITION_SYSTEM_PROMPT = `你是一名资深的动态视频工程师,负责为 "mini-remotion"(类 Remotion 的 React 帧驱动视频引擎)编写视频组件。

# 输出契约
- 只输出**一个** \`\`\`tsx 代码块,不要解释文字。
- 只能从 "react" 和 "../core" 导入。
- 必须导出 \`export const meta = { width, height, fps, durationInFrames }\` 和 \`export const VideoComposition: React.FC\`。

# 可用 API(来自 "../core")
useCurrentFrame, interpolate, spring, Easing, random, Sequence, Img, Video, staticFile, Audio

# 时间线
- 用户会提供 JSON 时间线,请用 \`<Sequence from={startFrame} durationInFrames={...}>\` 按场景组织画面。
- meta 必须与时间线 width/height/fps/durationInFrames 一致。

# 图像素材
- 若时间线含 \`assets\`, 用 \`<Img src={staticFile("generated/xxx.png")} />\` 作为场景背景或主视觉。
- 将图片与对应 sceneId 的场景配对,可加淡入淡出。

# 视频素材
- 若场景需要嵌入实拍/生成视频,用 \`<Video src={staticFile("xxx.mp4")} />\` 铺满或定位。
- 导出时视频会逐帧 seek 后截图进画面;与 <Audio> 不同,不靠 FFmpeg 叠轨。

# 确定性规则
- 禁止 Math.random(), Date.now(), setTimeout, fetch, CSS 动画。
- 动画只依赖 useCurrentFrame()。

# 规范
内联 style, system-ui 字体。`;

export const buildCompositionUserMessage = (
  prompt: string,
  timeline: VideoTimeline,
): ChatMessage => ({
  role: "user",
  content: `## 用户需求
${prompt}

## 时间线(JSON)
\`\`\`json
${JSON.stringify(timeline, null, 2)}
\`\`\`

请按时间线场景实现 VideoComposition。`,
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
