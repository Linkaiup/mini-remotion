import { makeDraftComponent } from "./draft/DraftRenderer";
import { sampleDraft } from "./draft/sample-draft";
import type { Composition } from "./core";
import { CodeDemo } from "./video/CodeDemo";

/**
 * 组合注册表:整个 App 的"数据层清单"。
 * 一个来自草稿层(翻译而来),一个是纯代码 —— 两者对渲染层完全一致。
 */
export const compositions: Composition[] = [
  {
    id: sampleDraft.id,
    width: sampleDraft.width,
    height: sampleDraft.height,
    fps: sampleDraft.fps,
    durationInFrames: sampleDraft.durationInFrames,
    component: makeDraftComponent(sampleDraft),
  },
  {
    id: "CodeDemo",
    width: 1280,
    height: 720,
    fps: 30,
    durationInFrames: 150,
    component: CodeDemo,
  },
];

export const getComposition = (id: string): Composition | undefined =>
  compositions.find((c) => c.id === id);
