/** 时间线上的一个场景片段 */
export type TimelineScene = {
  id: string;
  label: string;
  startFrame: number;
  endFrame: number;
  description: string;
};

/** 已生成的图像素材(Seedream 等) */
export type TimelineAsset = {
  id: string;
  sceneId: string;
  prompt: string;
  /** public/ 相对路径 */
  path: string;
  sourceUrl?: string;
};

/** Timeline Planning 产出 — 驱动 React Composition 与 Frame Scheduler */
export type VideoTimeline = {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  summary: string;
  scenes: TimelineScene[];
  assets?: TimelineAsset[];
};
