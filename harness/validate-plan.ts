import { writeGenerated } from "../engine/write-generated.js";
import { runTsc, smokeTestAtFrames } from "../engine/validate.js";
import { extractCode, staticCheck } from "./code.js";
import { lintComposition } from "./analysis/compose-lint.js";
import { harnessFail, harnessLog } from "./log.js";
import { buildRepairMessage } from "./composition/prompts.js";
import type { HarnessContext } from "./types.js";
import type { VideoTimeline } from "./timeline/types.js";

export type ValidatePlanResult =
  | { ok: true }
  | { ok: false; stage: string; errors: string };

/** 每场景取中点帧 + 首尾帧 */
export const sampleFramesForTimeline = (timeline: VideoTimeline): number[] => {
  const frames = new Set<number>([0, timeline.durationInFrames - 1]);
  for (const scene of timeline.scenes) {
    const mid = Math.floor((scene.startFrame + scene.endFrame) / 2);
    frames.add(Math.max(0, Math.min(mid, timeline.durationInFrames - 1)));
  }
  return [...frames].sort((a, b) => a - b);
};

/** VALIDATE: 静态契约 + tsc + 分场景冒烟 */
export const validatePlan = async (
  ctx: HarnessContext,
): Promise<ValidatePlanResult> => {
  harnessLog("VALIDATE", "① 静态契约检查…");
  const staticIssues = staticCheck(ctx.code);
  if (staticIssues.length > 0) {
    const errors = staticIssues.map((s) => `- ${s}`).join("\n");
    harnessFail("VALIDATE", "静态契约未通过", errors);
    return { ok: false, stage: "static", errors };
  }
  harnessLog("VALIDATE", "   通过");

  if (ctx.timeline) {
    harnessLog("VALIDATE", "②b Composition 静态分析…");
    const lintIssues = lintComposition(ctx.code, ctx.timeline);
    if (lintIssues.length > 0) {
      const errors = lintIssues.map((s) => `- ${s}`).join("\n");
      harnessFail("VALIDATE", "Composition 分析未通过", errors);
      return { ok: false, stage: "static", errors };
    }
    harnessLog("VALIDATE", "   通过");
  }

  harnessLog("VALIDATE", "③ 写入 src/generated/current.tsx…");
  await writeGenerated(ctx.code);
  harnessLog("VALIDATE", "   已写入");

  harnessLog("VALIDATE", "④ TypeScript 编译…");
  const tscErr = await runTsc();
  if (tscErr) {
    harnessFail("VALIDATE", "TypeScript 编译失败", tscErr);
    return { ok: false, stage: "tsc", errors: tscErr };
  }
  harnessLog("VALIDATE", "   通过");

  const smokeFrames = ctx.timeline
    ? sampleFramesForTimeline(ctx.timeline)
    : [0];
  harnessLog(
    "VALIDATE",
    `⑤ 浏览器冒烟(帧 ${smokeFrames.join(", ")})…`,
  );
  const smokeErr = await smokeTestAtFrames(smokeFrames);
  if (smokeErr) {
    harnessFail("VALIDATE", "冒烟测试失败", smokeErr);
    return { ok: false, stage: "smoke", errors: smokeErr };
  }
  harnessLog("VALIDATE", "   通过");

  return { ok: true };
};

export const appendRepairMessage = (
  ctx: HarnessContext,
  errors: string,
): void => {
  ctx.messages.push(buildRepairMessage(ctx.code, errors));
};

export const extractGeneratedCode = extractCode;
