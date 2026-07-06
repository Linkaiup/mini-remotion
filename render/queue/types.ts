/**
 * 分布式帧截图队列 — 类型定义。
 */
import type { AudioEntry } from "../pipeline.js";

export type QueueJobStatus = "pending" | "running" | "done" | "failed";

/** 单个帧段截图任务(对应 frame-scheduler 的一个 FrameJob) */
export type FrameCaptureJob = {
  id: string;
  batchId: string;
  status: QueueJobStatus;
  comp: string;
  /** 渲染站点 base URL(dev 或 bundle preview) */
  url: string;
  range: [number, number];
  propsB64: string;
  framesDir: string;
  workerId?: string;
  createdAt: number;
  startedAt?: number;
  finishedAt?: number;
  error?: string;
  /** worker 完成时附带的音频轨清单 */
  audios?: AudioEntry[];
};

export type FrameCaptureBatch = {
  batchId: string;
  comp: string;
  url: string;
  framesDir: string;
  propsB64: string;
  totalJobs: number;
  createdAt: number;
};
