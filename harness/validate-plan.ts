import { writeGenerated } from "../engine/write-generated.js";
import { runTsc, smokeTest } from "../engine/validate.js";
import { extractCode, staticCheck } from "./code.js";
import { harnessFail, harnessLog } from "./log.js";
import { buildRepairMessage } from "./prompts.js";
import type { HarnessContext } from "./types.js";

export type ValidatePlanResult =
  | { ok: true }
  | { ok: false; stage: string; errors: string };

/** VALIDATE_PLAN: 静态契约 + tsc + 冒烟 */
export const validatePlan = async (
  ctx: HarnessContext,
): Promise<ValidatePlanResult> => {
  harnessLog("VALIDATE_PLAN", "① 静态契约检查…");
  const staticIssues = staticCheck(ctx.code);
  if (staticIssues.length > 0) {
    const errors = staticIssues.map((s) => `- ${s}`).join("\n");
    harnessFail("VALIDATE_PLAN", "静态契约未通过", errors);
    return { ok: false, stage: "static", errors };
  }
  harnessLog("VALIDATE_PLAN", "   通过");

  harnessLog("VALIDATE_PLAN", "② 写入 src/generated/current.tsx…");
  await writeGenerated(ctx.code);
  harnessLog("VALIDATE_PLAN", "   已写入");

  harnessLog("VALIDATE_PLAN", "③ TypeScript 编译…");
  const tscErr = await runTsc();
  if (tscErr) {
    harnessFail("VALIDATE_PLAN", "TypeScript 编译失败", tscErr);
    return { ok: false, stage: "tsc", errors: tscErr };
  }
  harnessLog("VALIDATE_PLAN", "   通过");

  harnessLog("VALIDATE_PLAN", "④ 浏览器冒烟(第 0 帧)…");
  const smokeErr = await smokeTest();
  if (smokeErr) {
    harnessFail("VALIDATE_PLAN", "冒烟测试失败", smokeErr);
    return { ok: false, stage: "smoke", errors: smokeErr };
  }
  harnessLog("VALIDATE_PLAN", "   通过");

  return { ok: true };
};

export const appendRepairMessage = (
  ctx: HarnessContext,
  errors: string,
): void => {
  ctx.messages.push(buildRepairMessage(ctx.code, errors));
};

export const extractGeneratedCode = extractCode;
