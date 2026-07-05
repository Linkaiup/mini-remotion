import { writeGenerated } from "../engine/write-generated.js";
import { runValidate } from "../engine/validate.js";
import { extractCode, staticCheck } from "./code.js";
import { buildRepairMessage } from "./prompts.js";
import type { HarnessContext } from "./types.js";

export type ValidatePlanResult =
  | { ok: true }
  | { ok: false; errors: string };

/** VALIDATE_PLAN: 静态契约 + tsc + 冒烟 */
export const validatePlan = async (ctx: HarnessContext): Promise<ValidatePlanResult> => {
  const staticIssues = staticCheck(ctx.code);
  if (staticIssues.length > 0) {
    return { ok: false, errors: staticIssues.map((s) => `- ${s}`).join("\n") };
  }

  await writeGenerated(ctx.code);

  const engine = await runValidate();
  if (!engine.ok) {
    const parts: string[] = [];
    if (engine.tsc) parts.push(`TypeScript:\n${engine.tsc}`);
    if (engine.smoke) parts.push(`运行时:\n${engine.smoke}`);
    return { ok: false, errors: parts.join("\n") || "引擎校验失败" };
  }

  return { ok: true };
};

export const appendRepairMessage = (
  ctx: HarnessContext,
  errors: string,
): void => {
  ctx.messages.push(buildRepairMessage(ctx.code, errors));
};

export const extractGeneratedCode = extractCode;
