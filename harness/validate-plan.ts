import { writeGenerated } from "../engine/write-generated.js";
import { runTsc, smokeTest } from "../engine/validate.js";
import { extractCode, staticCheck } from "./code.js";
import { harnessFail, harnessLog } from "./log.js";
import { buildRepairMessage } from "./composition/prompts.js";
import type { HarnessContext } from "./types.js";

export type ValidatePlanResult =
  | { ok: true }
  | { ok: false; stage: string; errors: string };

/** VALIDATE: 静态契约 + tsc + 冒烟 */
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

  harnessLog("VALIDATE", "② 写入 src/generated/current.tsx…");
  await writeGenerated(ctx.code);
  harnessLog("VALIDATE", "   已写入");

  harnessLog("VALIDATE", "③ TypeScript 编译…");
  const tscErr = await runTsc();
  if (tscErr) {
    harnessFail("VALIDATE", "TypeScript 编译失败", tscErr);
    return { ok: false, stage: "tsc", errors: tscErr };
  }
  harnessLog("VALIDATE", "   通过");

  harnessLog("VALIDATE", "④ 浏览器冒烟(第 0 帧)…");
  const smokeErr = await smokeTest();
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
