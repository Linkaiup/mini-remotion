import type { HarnessStatus } from "./types.js";

export const harnessLog = (status: HarnessStatus | string, msg: string) =>
  console.log(`[harness:${status}] ${msg}`);

/** 打印失败摘要 + 缩进详情(最多 maxLines 行) */
export const harnessFail = (
  status: HarnessStatus | string,
  summary: string,
  detail?: string,
  maxLines = 12,
) => {
  console.log(`[harness:${status}] ✗ ${summary}`);
  if (!detail?.trim()) return;
  const lines = detail.trim().split("\n");
  const shown = lines.slice(0, maxLines);
  for (const line of shown) console.log(`  ${line}`);
  if (lines.length > maxLines) {
    console.log(`  … 还有 ${lines.length - maxLines} 行`);
  }
};
