import type React from "react";

/**
 * 一个 Composition = 一段可渲染视频的元信息 + 内容组件。
 * 注意:这里不存"每帧内容",只存"如何根据帧号计算内容"(component)。
 */
export type CompositionMeta = {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

export type Composition = CompositionMeta & {
  component: React.FC;
};
