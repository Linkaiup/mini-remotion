/**
 * 分布式帧截图 — 协调器与 worker 执行逻辑。
 *
 * 协调器:把 FrameSchedule 的 jobs 写入文件队列,启动本地 worker 池消费。
 * 外部机器可另开终端运行 npm run queue:worker -- <batchId> 参与同一批次。
 */
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { AudioEntry, Meta } from "../pipeline.js";
import type { FrameSchedule } from "../frame-scheduler.js";
import {
  claimNextJob,
  completeJob,
  createBatch,
  failJob,
  waitForBatch,
} from "./file-queue.js";
import type { FrameCaptureBatch } from "./types.js";

const LAUNCH_ARGS = [
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
];

/** 与 pipeline.renderJob 相同逻辑的帧段截图(供队列 worker 复用) */
export const executeCaptureRange = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: any,
  job: {
    url: string;
    comp: string;
    range: [number, number];
    propsB64: string;
    framesDir: string;
  },
): Promise<{ meta: Meta; audios: AudioEntry[] }> => {
  const { url, comp, range, propsB64, framesDir } = job;
  const { join } = await import("node:path");
  const page = await browser.newPage();
  const localAudios = new Map<string, AudioEntry>();
  try {
    const propsQuery = propsB64 ? `&props=${encodeURIComponent(propsB64)}` : "";
    const target = `${url}/?headless=1&comp=${encodeURIComponent(comp)}${propsQuery}`;
    await page.goto(target, { waitUntil: "networkidle0" });

    await page.waitForFunction(() => Boolean(window.__miniRemotionMeta), {
      timeout: 15000,
    });
    const meta = (await page.evaluate(() => window.__miniRemotionMeta!)) as Meta;
    await page.setViewport({ width: meta.width, height: meta.height });

    const canvas = await page.$("#mini-remotion-canvas");
    if (!canvas) throw new Error("找不到 #mini-remotion-canvas");

    for (let i = range[0]; i < range[1]; i++) {
      await page.evaluate((frame: number) => {
        window.__miniRemotionSetFrame?.(frame);
      }, i);
      await page.evaluate(
        () =>
          new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          ),
      );
      await page.waitForFunction(() => window.__miniRemotionReady === true, {
        timeout: 15000,
      });
      const frameAudios = (await page.evaluate(
        () => window.__miniRemotionGetAudio?.() ?? [],
      )) as AudioEntry[];
      for (const a of frameAudios) localAudios.set(a.id, a);
      await canvas.screenshot({
        path: join(framesDir, `frame-${String(i).padStart(6, "0")}.png`),
      });
    }
    return { meta, audios: Array.from(localAudios.values()) };
  } finally {
    await page.close();
  }
};

/** 单个 worker 循环:claim → 截图 → complete/fail */
export const runQueueWorker = async (
  batchId: string,
  workerId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  puppeteer: any,
): Promise<{ processed: number; audios: AudioEntry[] }> => {
  const mergedAudios = new Map<string, AudioEntry>();
  let processed = 0;
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 60000,
    args: LAUNCH_ARGS,
  });

  try {
    for (;;) {
      const job = await claimNextJob(batchId, workerId);
      if (!job) break;

      try {
        const { audios } = await executeCaptureRange(browser, {
          url: job.url,
          comp: job.comp,
          range: job.range,
          propsB64: job.propsB64,
          framesDir: job.framesDir,
        });
        for (const a of audios) mergedAudios.set(a.id, a);
        await completeJob(batchId, job.id, audios);
        processed++;
      } catch (e) {
        await failJob(
          batchId,
          job.id,
          e instanceof Error ? e.message : String(e),
        );
      }
    }
  } finally {
    await browser.close();
  }

  return { processed, audios: Array.from(mergedAudios.values()) };
};

export type DistributedCaptureResult = {
  meta: Meta;
  framesDir: string;
  audios: AudioEntry[];
  batchId: string;
};

/**
 * 协调器:创建批次 + 本地 worker 池并行消费。
 * poolSize 个 worker 进程逻辑各自 claim 任务(通过文件锁 rename)。
 */
export const captureFramesDistributed = async (opts: {
  comp: string;
  url: string;
  schedule: FrameSchedule;
  propsB64?: string;
  framesDir?: string;
  poolSize?: number;
}): Promise<DistributedCaptureResult> => {
  const propsB64 = opts.propsB64 ?? "";
  const framesDir = resolve(opts.framesDir ?? "out/frames");
  const { jobs, meta, poolSize } = opts.schedule;
  const batchId = randomUUID();

  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const batch: FrameCaptureBatch = {
    batchId,
    comp: opts.comp,
    url: opts.url,
    framesDir,
    propsB64,
    totalJobs: jobs.length,
    createdAt: Date.now(),
  };

  await createBatch(
    batch,
    jobs.map((j) => ({
      id: String(j.id),
      batchId,
      comp: opts.comp,
      url: opts.url,
      range: j.range,
      propsB64,
      framesDir,
    })),
  );

  console.log(
    `[queue] 批次 ${batchId}: ${jobs.length} 任务, pool=${poolSize}`,
  );

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let puppeteer: any;
  puppeteer = await import("puppeteer" as string);

  const workers = poolSize;
  const workerResults = await Promise.all(
    Array.from({ length: workers }, (_, i) =>
      runQueueWorker(batchId, `local-${i}`, puppeteer),
    ),
  );

  const { failed } = await waitForBatch(batchId);
  const done = workerResults.reduce((s, w) => s + w.processed, 0);
  if (failed > 0) {
    throw new Error(`分布式队列有 ${failed} 个任务失败(done=${done})`);
  }

  const audioMap = new Map<string, AudioEntry>();
  for (const w of workerResults) {
    for (const a of w.audios) audioMap.set(a.id, a);
  }

  return {
    meta,
    framesDir,
    audios: Array.from(audioMap.values()),
    batchId,
  };
};
