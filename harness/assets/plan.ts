import type { VideoTimeline } from "../timeline/types.js";
import type { AssetPlan, PlannedAsset } from "./types.js";

const MAX_ASSETS = 3;

/** 从时间线场景推导 Seedream 图像需求 */
export const planAssetsFromTimeline = (timeline: VideoTimeline): AssetPlan => {
  const scenes = timeline.scenes.slice(0, MAX_ASSETS);
  const styleHint = timeline.summary.slice(0, 80);

  const assets: PlannedAsset[] = scenes.map((scene) => ({
    id: `img-${scene.id}`,
    sceneId: scene.id,
    prompt: [
      scene.description,
      styleHint ? `整体风格: ${styleHint}` : "",
      "高清, 适合作为视频背景, 16:9 构图, 电影感",
    ]
      .filter(Boolean)
      .join(", "),
  }));

  return { assets };
};
