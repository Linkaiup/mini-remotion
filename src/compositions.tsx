import { makeDraftComponent } from "./draft/DraftRenderer";
import { sampleDraft } from "./draft/sample-draft";
import type { Draft } from "./draft/types";
import type { AnyComposition } from "./core";
import agentDraftJson from "./generated/draft.json";
import {
  CodeDemo,
  codeDemoDefaultProps,
  codeDemoSchema,
} from "./video/CodeDemo";
import { VideoDemo, videoDemoMeta } from "./video/VideoDemo";
import {
  VideoComposition as GeneratedVideo,
  meta as generatedMeta,
} from "./generated/current";

/** Agent 导出的草稿 JSON(harness/draft/export.ts 写入) */
const agentDraft = agentDraftJson as Draft;

/**
 * 组合注册表:整个 App 的"数据层清单"。
 * 一个来自草稿层(翻译而来),一个是纯代码 + props 驱动(带 zod schema)。
 */
export const compositions: AnyComposition[] = [
  {
    id: sampleDraft.id,
    width: sampleDraft.width,
    height: sampleDraft.height,
    fps: sampleDraft.fps,
    durationInFrames: sampleDraft.durationInFrames,
    defaultProps: {},
    component: makeDraftComponent(sampleDraft),
  },
  {
    id: "CodeDemo",
    width: 1280,
    height: 720,
    fps: 30,
    durationInFrames: 150,
    schema: codeDemoSchema,
    defaultProps: codeDemoDefaultProps,
    component: CodeDemo as AnyComposition["component"],
  },
  // <Video> 组件演示(需 npm run make-video)
  {
    id: "VideoDemo",
    width: videoDemoMeta.width,
    height: videoDemoMeta.height,
    fps: videoDemoMeta.fps,
    durationInFrames: videoDemoMeta.durationInFrames,
    defaultProps: {},
    component: VideoDemo as AnyComposition["component"],
  },
  // Agent 生成的视频(内容来自 src/generated/current.tsx)
  {
    id: "GeneratedVideo",
    width: generatedMeta.width,
    height: generatedMeta.height,
    fps: generatedMeta.fps,
    durationInFrames: generatedMeta.durationInFrames,
    defaultProps: {},
    component: GeneratedVideo as AnyComposition["component"],
  },
  // Agent 草稿层(数据来自 src/generated/draft.json,与 GeneratedVideo 同源 timeline)
  {
    id: "AgentDraft",
    width: agentDraft.width,
    height: agentDraft.height,
    fps: agentDraft.fps,
    durationInFrames: agentDraft.durationInFrames,
    defaultProps: {},
    component: makeDraftComponent(agentDraft),
  },
];

export const getComposition = (id: string): AnyComposition | undefined =>
  compositions.find((c) => c.id === id);
