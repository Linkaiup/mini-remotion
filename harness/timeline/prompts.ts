import type { ChatMessage } from "../llm/types.js";

export const TIMELINE_SYSTEM_PROMPT = `你是视频分镜规划师,为 mini-remotion 帧驱动引擎输出时间线 JSON。

# 输出契约
- 只输出一个 \`\`\`json 代码块,不要解释。
- 结构:
{
  "width": 1280,
  "height": 720,
  "fps": 30,
  "durationInFrames": 120,
  "summary": "一句话概述",
  "scenes": [
    { "id": "intro", "label": "开场", "startFrame": 0, "endFrame": 40, "description": "..." }
  ]
}
- scenes 2~4 段,首尾相接覆盖 0..durationInFrames,无重叠无空隙。
- durationInFrames 范围 90~240。`;

export const buildTimelineUserMessage = (prompt: string): ChatMessage => ({
  role: "user",
  content: `请为以下视频需求规划时间线:\n\n${prompt}`,
});
