/**
 * 基于文件系统的帧任务队列。
 *
 * 目录结构:
 *   out/queue/<batchId>/
 *     batch.json          — 批次元数据
 *     pending/<jobId>.json
 *     running/<jobId>.json
 *     done/<jobId>.json
 *     failed/<jobId>.json
 *
 * claim 通过 rename(pending → running) 实现原子抢占,适合 NFS/本地盘。
 */
import { mkdir, readdir, readFile, rename, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { FrameCaptureBatch, FrameCaptureJob, QueueJobStatus } from "./types.js";
import type { AudioEntry } from "../pipeline.js";

const QUEUE_ROOT = resolve("out/queue");

const batchDir = (batchId: string) => join(QUEUE_ROOT, batchId);
const statusDir = (batchId: string, status: QueueJobStatus) =>
  join(batchDir(batchId), status);

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const createBatch = async (
  batch: FrameCaptureBatch,
  jobs: Omit<FrameCaptureJob, "status" | "createdAt">[],
): Promise<string> => {
  const dir = batchDir(batch.batchId);
  await mkdir(join(dir, "pending"), { recursive: true });
  await mkdir(join(dir, "running"), { recursive: true });
  await mkdir(join(dir, "done"), { recursive: true });
  await mkdir(join(dir, "failed"), { recursive: true });
  await writeFile(join(dir, "batch.json"), JSON.stringify(batch, null, 2));

  for (const job of jobs) {
    const full: FrameCaptureJob = {
      ...job,
      status: "pending",
      createdAt: Date.now(),
    };
    await writeFile(
      join(dir, "pending", `${job.id}.json`),
      JSON.stringify(full, null, 2),
    );
  }
  return dir;
};

/** 原子抢占下一个 pending 任务;无任务时返回 null */
export const claimNextJob = async (
  batchId: string,
  workerId: string,
): Promise<FrameCaptureJob | null> => {
  const pending = statusDir(batchId, "pending");
  let names: string[];
  try {
    names = await readdir(pending);
  } catch {
    return null;
  }
  names.sort();

  for (const name of names) {
    const from = join(pending, name);
    const to = join(statusDir(batchId, "running"), name);
    try {
      await rename(from, to);
      const raw = await readFile(to, "utf-8");
      const job = JSON.parse(raw) as FrameCaptureJob;
      job.status = "running";
      job.workerId = workerId;
      job.startedAt = Date.now();
      await writeFile(to, JSON.stringify(job, null, 2));
      return job;
    } catch {
      // 被其他 worker 抢走,尝试下一个
    }
  }
  return null;
};

const moveJob = async (
  batchId: string,
  jobId: string,
  from: QueueJobStatus,
  to: QueueJobStatus,
  patch: Partial<FrameCaptureJob>,
): Promise<void> => {
  const fromPath = join(statusDir(batchId, from), `${jobId}.json`);
  const toPath = join(statusDir(batchId, to), `${jobId}.json`);
  const raw = await readFile(fromPath, "utf-8");
  const job = { ...JSON.parse(raw), ...patch, status: to } as FrameCaptureJob;
  await writeFile(toPath, JSON.stringify(job, null, 2));
  const { unlink } = await import("node:fs/promises");
  await unlink(fromPath).catch(() => undefined);
};

export const completeJob = async (
  batchId: string,
  jobId: string,
  audios?: AudioEntry[],
): Promise<void> =>
  moveJob(batchId, jobId, "running", "done", {
    finishedAt: Date.now(),
    ...(audios ? { audios } : {}),
  });

export const failJob = async (
  batchId: string,
  jobId: string,
  error: string,
): Promise<void> =>
  moveJob(batchId, jobId, "running", "failed", {
    finishedAt: Date.now(),
    error,
  });

export const countJobs = async (
  batchId: string,
  status: QueueJobStatus,
): Promise<number> => {
  try {
    const names = await readdir(statusDir(batchId, status));
    return names.filter((n) => n.endsWith(".json")).length;
  } catch {
    return 0;
  }
};

/** 轮询直到 pending+running 为 0 或超时 */
export const waitForBatch = async (
  batchId: string,
  opts?: { timeoutMs?: number; pollMs?: number },
): Promise<{ done: number; failed: number }> => {
  const timeoutMs = opts?.timeoutMs ?? 600_000;
  const pollMs = opts?.pollMs ?? 500;
  const start = Date.now();

  while (Date.now() - start < timeoutMs) {
    const pending = await countJobs(batchId, "pending");
    const running = await countJobs(batchId, "running");
    const done = await countJobs(batchId, "done");
    const failed = await countJobs(batchId, "failed");

    if (pending === 0 && running === 0) {
      return { done, failed };
    }
    await sleep(pollMs);
  }
  throw new Error(`队列批次 ${batchId} 等待超时`);
};

export const loadBatch = async (batchId: string): Promise<FrameCaptureBatch> => {
  const raw = await readFile(join(batchDir(batchId), "batch.json"), "utf-8");
  return JSON.parse(raw) as FrameCaptureBatch;
};

export const listBatches = async (): Promise<string[]> => {
  try {
    return await readdir(QUEUE_ROOT);
  } catch {
    return [];
  }
};
