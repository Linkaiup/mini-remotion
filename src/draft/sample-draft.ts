import type { Draft } from "./types";

/**
 * 一份示例草稿(纯 JSON 数据)。想象它由可视化编辑器拖拽生成。
 * 修改这里的数值,预览会立刻变化 —— 这就是"草稿驱动"的视频。
 */
export const sampleDraft: Draft = {
  id: "DraftDemo",
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 150,
  background: "linear-gradient(135deg, #1e3a8a 0%, #0f172a 100%)",
  items: [
    {
      id: "bg-card",
      type: "rect",
      from: 0,
      durationInFrames: 150,
      x: 240,
      y: 180,
      width: 800,
      height: 360,
      color: "rgba(255,255,255,0.06)",
      radius: 24,
      animation: "fadeIn",
    },
    {
      id: "title",
      type: "text",
      from: 10,
      durationInFrames: 140,
      x: 300,
      y: 260,
      text: "Mini Remotion",
      fontSize: 88,
      color: "#ffffff",
      fontWeight: 800,
      animation: "springPop",
    },
    {
      id: "subtitle",
      type: "text",
      from: 30,
      durationInFrames: 120,
      x: 302,
      y: 380,
      text: "草稿 → 数据 → 渲染 → 驱动",
      fontSize: 36,
      color: "#93c5fd",
      fontWeight: 500,
      animation: "slideInLeft",
    },
    {
      id: "accent",
      type: "rect",
      from: 45,
      durationInFrames: 105,
      x: 302,
      y: 450,
      width: 120,
      height: 8,
      color: "#38bdf8",
      radius: 4,
      animation: "slideInLeft",
    },
  ],
};
