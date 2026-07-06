import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { harnessLog } from "./log.js";
import type { HarnessContext, HarnessResult } from "./types.js";

export const finalizeOutput = async (
  ctx: HarnessContext,
  result: Omit<HarnessResult, "status">,
): Promise<HarnessResult> => {
  harnessLog("OUTPUT", "汇总产物…");
  if (result.videoPath) harnessLog("OUTPUT", `   video: ${result.videoPath}`);
  harnessLog("OUTPUT", `   code:  ${result.codePath}`);
  if (result.timeline) {
    harnessLog(
      "OUTPUT",
      `   timeline: ${result.timeline.scenes.length} 场景, ${result.timeline.durationInFrames} 帧`,
    );
  }
  if (result.quality) {
    harnessLog("OUTPUT", `   quality: ${result.quality.score.toFixed(2)}`);
  }
  if (result.assets?.length) {
    harnessLog("OUTPUT", `   assets:  ${result.assets.length} 张`);
  }

  if (result.cost) {
    harnessLog(
      "OUTPUT",
      `   cost:    $${result.cost.totalUsd.toFixed(4)} (${result.cost.totalLlmTokens} tokens)`,
    );
  }

  if (result.preview) {
    harnessLog(
      "OUTPUT",
      `   preview: ${result.preview.score.toFixed(2)} (${result.preview.ok ? "ok" : "issues"})`,
    );
  }
  if (result.draftPath) {
    harnessLog("OUTPUT", `   draft:   ${result.draftPath}`);
  }

  const manifest = {
    prompt: ctx.prompt,
    promptHash: ctx.promptHash,
    provider: result.provider,
    attempts: result.attempts,
    timeline: result.timeline,
    assets: result.assets,
    videoPath: result.videoPath,
    codePath: result.codePath,
    draftPath: result.draftPath,
    quality: result.quality,
    preview: result.preview,
    cost: result.cost,
    frameSchedule: ctx.frameSchedule
      ? {
          jobs: ctx.frameSchedule.jobs.length,
          poolSize: ctx.frameSchedule.poolSize,
          totalFrames: ctx.frameSchedule.totalFrames,
        }
      : undefined,
  };

  const manifestPath = resolve("out/agent-manifest.json");
  await writeFile(manifestPath, JSON.stringify(manifest, null, 2), "utf-8");
  harnessLog("OUTPUT", `   manifest: ${manifestPath}`);

  return { status: "DONE", ...result, manifestPath };
};
