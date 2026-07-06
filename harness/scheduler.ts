import { cpus, freemem, totalmem } from "node:os";

export type SchedulerHints = {
  cpuCores: number;
  freeMemGb: number;
  totalMemGb: number;
};

export const getSchedulerHints = (): SchedulerHints => ({
  cpuCores: cpus().length,
  freeMemGb: freemem() / 1024 ** 3,
  totalMemGb: totalmem() / 1024 ** 3,
});

/** 每 Chromium 进程约 400–500MB */
const CHROMIUM_GB = Number(process.env.CHROMIUM_MEM_GB ?? "0.45");

/**
 * 智能 pool 大小: CPU、可用内存、总帧数 取最小值
 */
export const pickPoolSize = (opts: {
  requested?: number;
  totalFrames?: number;
}): number => {
  const { cpuCores, freeMemGb } = getSchedulerHints();
  const cpuCap = Math.min(cpuCores, Number(process.env.MAX_POOL_SIZE ?? "4"));
  const memCap = Math.max(1, Math.floor(freeMemGb / CHROMIUM_GB));
  let size = Math.min(cpuCap, memCap);

  if (opts.totalFrames !== undefined && opts.totalFrames > 0) {
    const minFramesPerJob = Number(process.env.MIN_FRAMES_PER_JOB ?? "24");
    const jobCap = Math.max(1, Math.ceil(opts.totalFrames / minFramesPerJob));
    size = Math.min(size, jobCap);
  }

  if (opts.requested !== undefined && opts.requested > 0) {
    size = Math.min(size, opts.requested);
  }

  return Math.max(1, size);
};

export const pickConcurrency = (requested?: number): number =>
  pickPoolSize({ requested });

/** OPTIMIZE: 渲染失败降并发 */
export const optimizeConcurrency = (
  current: number,
  reason: "validate" | "render" | "quality",
): number => {
  if (reason === "render") {
    return Math.max(1, Math.floor(current / 2));
  }
  if (reason === "quality") {
    return Math.max(1, current - 1);
  }
  return current;
};

/** 渲染超时: 基础 30s + 每帧 500ms, 上限 10min */
export const renderTimeoutMs = (totalFrames: number): number => {
  const base = Number(process.env.RENDER_TIMEOUT_BASE_MS ?? "30000");
  const perFrame = Number(process.env.RENDER_TIMEOUT_PER_FRAME_MS ?? "500");
  const cap = Number(process.env.RENDER_TIMEOUT_MAX_MS ?? "600000");
  return Math.min(cap, base + totalFrames * perFrame);
};

export const llmTimeoutMs = (): number =>
  Number(process.env.LLM_TIMEOUT_MS ?? "120000");

export const withTimeout = <T>(
  promise: Promise<T>,
  ms: number,
  label: string,
): Promise<T> => {
  if (ms <= 0) return promise;
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} 超时 (${ms}ms)`)), ms);
    }),
  ]);
};
