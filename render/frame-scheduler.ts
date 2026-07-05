import { splitRanges } from "./pipeline.js";
import type { Meta } from "./pipeline.js";

/** Frame Scheduler 产出的单段渲染任务 */
export type FrameJob = {
  id: number;
  range: [number, number];
  frameCount: number;
};

export type FrameSchedule = {
  meta: Meta;
  jobs: FrameJob[];
  poolSize: number;
  totalFrames: number;
};

/** 将总帧数切分为并行任务, poolSize 即 Chromium Pool 大小 */
export const scheduleFrames = (
  meta: Meta,
  poolSize: number,
): FrameSchedule => {
  const ranges = splitRanges(meta.durationInFrames, poolSize);
  const jobs: FrameJob[] = ranges.map((range, id) => ({
    id,
    range,
    frameCount: range[1] - range[0],
  }));
  return {
    meta,
    jobs,
    poolSize: Math.min(poolSize, jobs.length),
    totalFrames: meta.durationInFrames,
  };
};
