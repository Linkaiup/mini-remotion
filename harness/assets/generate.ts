import { resolve } from "node:path";
import { harnessLog } from "../log.js";
import { recordImageUsage } from "../cost/pricing.js";
import type { VideoTimeline } from "../timeline/types.js";
import { planAssetsFromTimeline } from "./plan.js";
import { generateSeedreamImage, isSeedreamAvailable } from "./seedream.js";
import type { AssetGenerationResult, ResolvedAsset } from "./types.js";

const PUBLIC_GENERATED = resolve("public/generated");

/** Asset Planning + Seedream 5.0 生成并落盘 */
export const generateTimelineAssets = async (
  timeline: VideoTimeline,
  opts?: { forceSkip?: boolean },
): Promise<AssetGenerationResult> => {
  const plan = planAssetsFromTimeline(timeline);

  if (opts?.forceSkip || !isSeedreamAvailable()) {
    const reason = opts?.forceSkip
      ? "已禁用图像生成"
      : !process.env.ARK_API_KEY
        ? "未配置 ARK_API_KEY"
        : "MINI_REMOTION_IMAGES=noop";
    harnessLog("ASSET_GEN", `跳过 (${reason})`);
    return { assets: [], skipped: true, skipReason: reason };
  }

  if (plan.assets.length === 0) {
    return { assets: [], skipped: true, skipReason: "无素材需求" };
  }

  harnessLog("ASSET_GEN", `Seedream 生成 ${plan.assets.length} 张图…`);
  const resolved: ResolvedAsset[] = [];

  for (const asset of plan.assets) {
    const filename = `${asset.id}.png`;
    const absPath = resolve(PUBLIC_GENERATED, filename);
    const publicPath = `generated/${filename}`;

    harnessLog("ASSET_GEN", `   ${asset.id}: ${asset.prompt.slice(0, 50)}…`);
    try {
      const { url } = await generateSeedreamImage({
        prompt: asset.prompt,
        outPath: absPath,
      });
      resolved.push({ ...asset, path: publicPath, sourceUrl: url });
      recordImageUsage(`seedream:${asset.id}`, 1);
      harnessLog("ASSET_GEN", `   ✓ → public/${publicPath}`);
    } catch (e) {
      throw new Error(`素材 ${asset.id} 生成失败: ${e}`);
    }
  }

  return { assets: resolved, skipped: false };
};

/** 将已生成素材写回 timeline */
export const attachAssetsToTimeline = (
  timeline: VideoTimeline,
  assets: ResolvedAsset[],
): VideoTimeline => ({
  ...timeline,
  assets,
});
