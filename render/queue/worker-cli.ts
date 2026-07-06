#!/usr/bin/env node
/**
 * 分布式队列 Worker CLI — 在任意机器上消费指定批次的 pending 任务。
 *
 * 用法:
 *   npm run queue:worker -- <batchId>
 *   MINI_REMOTION_RENDER_MODE=bundle npm run queue:worker -- <batchId>
 *
 * 协调器创建批次后,可在另一终端/另一台机器运行本命令参与截图。
 */
import { resolve } from "node:path";
import { runQueueWorker } from "./distributed-capture.js";
import { countJobs } from "./file-queue.js";

const main = async () => {
  const batchId = process.argv[2];
  if (!batchId) {
    console.error("用法: npm run queue:worker -- <batchId>");
    process.exit(1);
  }

  process.env.PUPPETEER_CACHE_DIR = resolve(".puppeteer-cache");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let puppeteer: any;
  try {
    puppeteer = await import("puppeteer" as string);
  } catch {
    console.error("需要 puppeteer(npm install -D puppeteer)");
    process.exit(1);
  }

  const workerId = `remote-${process.pid}`;
  console.log(`[queue:worker] ${workerId} 加入批次 ${batchId}`);

  const { processed, audios } = await runQueueWorker(batchId, workerId, puppeteer);

  const pending = await countJobs(batchId, "pending");
  const running = await countJobs(batchId, "running");
  const done = await countJobs(batchId, "done");
  const failed = await countJobs(batchId, "failed");

  console.log(
    JSON.stringify({
      ok: true,
      workerId,
      processed,
      audios: audios.length,
      queue: { pending, running, done, failed },
    }),
  );
};

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
