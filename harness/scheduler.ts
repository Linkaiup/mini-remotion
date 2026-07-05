import { cpus } from "node:os";
import { defaultConcurrency } from "../render/pipeline.js";

export const pickConcurrency = (requested?: number): number => {
  if (requested !== undefined && requested > 0) {
    return Math.min(requested, 8);
  }
  return defaultConcurrency();
};

/** OPTIMIZE:根据失败原因调整并发度 */
export const optimizeConcurrency = (
  current: number,
  reason: "validate" | "render" | "quality",
): number => {
  if (reason === "render") {
    // 渲染超时/失败 → 降并发,减少资源争用
    return Math.max(1, Math.floor(current / 2));
  }
  if (reason === "quality") {
    return Math.max(1, current - 1);
  }
  return current;
};

export const maxCpuHint = (): number => cpus().length;
