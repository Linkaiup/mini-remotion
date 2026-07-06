/**
 * 分布式帧截图队列 — 类型定义。
 */
import type { RenderAsset } from "../pipeline.js";

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
  /** worker 完成时附带的媒体资产清单(audio + video 音轨) */
  renderAssets?: RenderAsset[];
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
