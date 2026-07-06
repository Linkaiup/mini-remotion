/** 失败类型 — 用于 OPTIMIZE 路由 */
export type FailureKind =
  | "static"
  | "tsc"
  | "smoke"
  | "preview"
  | "asset"
  | "timeline"
  | "render"
  | "visual"
  | "encode";

import type { HarnessStatus } from "./types.js";

export const parseFailureKind = (stage: string): FailureKind => {
  const map: Record<string, FailureKind> = {
    static: "static",
    tsc: "tsc",
    smoke: "smoke",
    preview: "preview",
    asset: "asset",
    timeline: "timeline",
    render: "render",
    visual: "visual",
    encode: "encode",
    chromium: "render",
    ffmpeg: "encode",
  };
  return map[stage] ?? "static";
};

/** 失败后下一状态(进入 OPTIMIZE 前设置 lastFailureKind, OPTIMIZE 据此跳转) */
export const targetAfterOptimize = (kind: FailureKind): HarnessStatus => {
  switch (kind) {
    case "timeline":
      return "TIMELINE_PLAN";
    case "asset":
      return "ASSET_GEN";
    case "render":
    case "encode":
      return "FRAME_SCHEDULE";
    case "static":
    case "tsc":
    case "smoke":
    case "preview":
    case "visual":
    default:
      return "COMPOSE";
  }
};

export const optimizeReasonLabel = (kind: FailureKind): string => {
  const labels: Record<FailureKind, string> = {
    static: "静态契约",
    tsc: "TypeScript",
    smoke: "冒烟",
    preview: "低清预览",
    asset: "素材",
    timeline: "时间线",
    render: "渲染",
    visual: "画面质量",
    encode: "编码",
  };
  return labels[kind];
};
