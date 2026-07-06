/**
 * 分布式帧截图 — 协调器与 worker 执行逻辑。
 *
 * 协调器:把 FrameSchedule 的 jobs 写入文件队列,启动本地 worker 池消费。
 * 外部机器可另开终端运行 npm run queue:worker -- <batchId> 参与同一批次。
 */
import { randomUUID } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import type { Meta, RenderAsset } from "../pipeline.js";
import { mergeFrameAssets } from "../pipeline.js";
import type { FrameSchedule } from "../frame-scheduler.js";
import { buildHeadlessUrl } from "../headless-url.js";
import { ensureOffthreadServer } from "../offthread/index.js";
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
): Promise<{ meta: Meta; renderAssets: RenderAsset[] }> => {
  const { url, comp, range, propsB64, framesDir } = job;
  const { join } = await import("node:path");
  const offthread = await ensureOffthreadServer();
  const page = await browser.newPage();
  const assetMap = new Map<string, RenderAsset>();
  try {
    const target = buildHeadlessUrl({
      baseUrl: url,
      comp,
      propsB64,
      proxyPort: offthread.port,
    });
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
      const frameAssets = (await page.evaluate(
        () => window.__miniRemotionCollectAssets?.() ?? [],
      )) as RenderAsset[];
      mergeFrameAssets(assetMap, frameAssets);
      await canvas.screenshot({
        path: join(framesDir, `frame-${String(i).padStart(6, "0")}.png`),
      });
    }
    return { meta, renderAssets: Array.from(assetMap.values()) };
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
): Promise<{ processed: number; renderAssets: RenderAsset[] }> => {
  const merged = new Map<string, RenderAsset>();
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
        const { renderAssets } = await executeCaptureRange(browser, {
          url: job.url,
          comp: job.comp,
          range: job.range,
          propsB64: job.propsB64,
          framesDir: job.framesDir,
        });
        for (const a of renderAssets) merged.set(a.id, a);
        await completeJob(batchId, job.id, renderAssets);
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

  return { processed, renderAssets: Array.from(merged.values()) };
};

export type DistributedCaptureResult = {
  meta: Meta;
  framesDir: string;
  renderAssets: RenderAsset[];
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

  const assetMap = new Map<string, RenderAsset>();
  for (const w of workerResults) {
    for (const a of w.renderAssets) assetMap.set(a.id, a);
  }

  return {
    meta,
    framesDir,
    renderAssets: Array.from(assetMap.values()),
    batchId,
  };
};
