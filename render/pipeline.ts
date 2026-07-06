/**
 * 渲染管线 — Frame Scheduler + Chromium Pool + FFmpeg
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";
import { ChromiumPool, runPoolTasks } from "./chromium-pool.js";
import { buildHeadlessUrl } from "./headless-url.js";
import { ensureOffthreadServer } from "./offthread/index.js";
import { scheduleFrames } from "./frame-scheduler.js";
import type { FrameSchedule } from "./frame-scheduler.js";
import { mergeAudioTracks } from "./audio/merge-tracks.js";
import { prepareAudioTracks } from "./audio/prepare-tracks.js";
import type { RenderAsset } from "../src/core/render-asset.js";

export type { RenderAsset };

export type Meta = {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

/** @deprecated 使用 RenderAsset */
export type AudioEntry = RenderAsset;

export type CaptureResult = {
  meta: Meta;
  framesDir: string;
  renderAssets: RenderAsset[];
  elapsedSeconds: number;
  schedule: FrameSchedule;
};

const LAUNCH_ARGS = [
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
];

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((res, rej) => {
    const ff = spawn("ffmpeg", args, { stdio: "inherit" });
    ff.on("error", rej);
    ff.on("close", (code: number | null) =>
      code === 0 ? res() : rej(new Error(`ffmpeg exited with ${code}`)),
    );
  });

export const mergeFrameAssets = (
  map: Map<string, RenderAsset>,
  frameAssets: RenderAsset[],
): void => {
  for (const a of frameAssets) map.set(a.id, a);
};

export const splitRanges = (total: number, count: number): [number, number][] => {
  const n = Math.min(count, total);
  const size = Math.ceil(total / n);
  const ranges: [number, number][] = [];
  for (let start = 0; start < total; start += size) {
    ranges.push([start, Math.min(start + size, total)]);
  }
  return ranges;
};

export const defaultConcurrency = (): number =>
  Math.min(4, Math.max(1, cpus().length));

const renderJob = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  browser: any,
  args: {
    url: string;
    comp: string;
    range: [number, number];
    propsB64: string;
    proxyPort: number;
  },
  framesDir: string,
  assetMap: Map<string, RenderAsset>,
  onFrameDone: () => void,
): Promise<Meta> => {
  const { url, comp, range, propsB64, proxyPort } = args;
  const page = await browser.newPage();
  try {
    const target = buildHeadlessUrl({ baseUrl: url, comp, propsB64, proxyPort });
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
      onFrameDone();
    }
    return meta;
  } finally {
    await page.close();
  }
};

/** 探测 composition meta(不占用 pool) */
export const probeMeta = async (opts: {
  comp: string;
  url: string;
  propsB64?: string;
}): Promise<Meta> => {
  const offthread = await ensureOffthreadServer();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let puppeteer: any;
  puppeteer = await import("puppeteer" as string);
  const browser = await puppeteer.launch({ headless: true, args: LAUNCH_ARGS });
  try {
    const page = await browser.newPage();
    await page.goto(
      buildHeadlessUrl({
        baseUrl: opts.url,
        comp: opts.comp,
        propsB64: opts.propsB64,
        proxyPort: offthread.port,
      }),
      { waitUntil: "networkidle0" },
    );
    await page.waitForFunction(() => Boolean(window.__miniRemotionMeta), {
      timeout: 15000,
    });
    return (await page.evaluate(() => window.__miniRemotionMeta!)) as Meta;
  } finally {
    await browser.close();
  }
};

/** Chromium Pool: 按 FrameSchedule 并行截图 */
export const captureFramesWithPool = async (opts: {
  comp: string;
  url?: string;
  schedule: FrameSchedule;
  propsB64?: string;
  framesDir?: string;
  /** 使用文件队列分布式截图(适合多 worker / 多机) */
  distributed?: boolean;
}): Promise<CaptureResult> => {
  const url = opts.url ?? "http://localhost:5173";
  const propsB64 = opts.propsB64 ?? "";
  const offthread = await ensureOffthreadServer();

  if (opts.distributed || process.env.MINI_REMOTION_DISTRIBUTED_QUEUE === "1") {
    const { captureFramesDistributed } = await import("./queue/distributed-capture.js");
    const started = Date.now();
    const result = await captureFramesDistributed({
      comp: opts.comp,
      url,
      schedule: opts.schedule,
      propsB64,
      framesDir: opts.framesDir,
      poolSize: opts.schedule.poolSize,
    });
    return {
      meta: result.meta,
      framesDir: result.framesDir,
      renderAssets: result.renderAssets,
      elapsedSeconds: (Date.now() - started) / 1000,
      schedule: opts.schedule,
    };
  }

  const framesDir = resolve(opts.framesDir ?? "out/frames");

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let puppeteer: any;
  try {
    puppeteer = await import("puppeteer" as string);
  } catch {
    throw new Error("需要 puppeteer(npm install -D puppeteer)");
  }

  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const { jobs, poolSize, meta } = opts.schedule;
  console.log(
    `[chromium-pool] ${opts.comp}: ${meta.durationInFrames} 帧 → ${jobs.length} 任务, pool=${poolSize}`,
  );

  const assetMap = new Map<string, RenderAsset>();
  let done = 0;
  const total = meta.durationInFrames;
  const onFrameDone = () => {
    done++;
    if (done % 15 === 0 || done === total) {
      process.stdout.write(`\r[chromium-pool] 截图 ${done}/${total}`);
    }
  };

  const pool = await ChromiumPool.create(puppeteer, poolSize, LAUNCH_ARGS);
  const started = Date.now();

  try {
    const metas = await runPoolTasks(
      pool,
      jobs.map(
        (job) => (browser) =>
          renderJob(
            browser,
            {
              url,
              comp: opts.comp,
              range: job.range,
              propsB64,
              proxyPort: offthread.port,
            },
            framesDir,
            assetMap,
            onFrameDone,
          ),
      ),
    );
    process.stdout.write("\n");

    return {
      meta: metas[0],
      framesDir,
      renderAssets: Array.from(assetMap.values()),
      elapsedSeconds: (Date.now() - started) / 1000,
      schedule: opts.schedule,
    };
  } finally {
    await pool.close();
  }
};

/** 兼容旧 API: 内部 probe + schedule + pool */
export const captureFrames = async (opts: {
  comp: string;
  url?: string;
  concurrency?: number;
  propsB64?: string;
  framesDir?: string;
}): Promise<CaptureResult> => {
  const url = opts.url ?? "http://localhost:5173";
  const poolSize = opts.concurrency ?? defaultConcurrency();
  const meta = await probeMeta({ comp: opts.comp, url, propsB64: opts.propsB64 });
  const schedule = scheduleFrames(meta, poolSize);
  return captureFramesWithPool({
    comp: opts.comp,
    url,
    schedule,
    propsB64: opts.propsB64,
    framesDir: opts.framesDir,
  });
};

const mixAudio = async (
  silentVideo: string,
  assets: RenderAsset[],
  fps: number,
  out: string,
): Promise<void> => {
  const tracks = await prepareAudioTracks(assets, fps);
  if (tracks.length === 0) return;
  const curved = assets.filter((a) => Array.isArray(a.volume)).length;
  console.log(
    `[ffmpeg] 混流 ${tracks.length} 条音轨 (audio=${tracks.filter((t) => t.sourceType === "audio").length}, video=${tracks.filter((t) => t.sourceType === "video").length}, 音量曲线=${curved})…`,
  );
  await mergeAudioTracks({ silentVideo, tracks, fps, out });
};

/** FFmpeg: 编码帧序列 + 可选音频混流 */
export const encodeVideo = async (opts: {
  meta: Meta;
  framesDir: string;
  renderAssets: RenderAsset[];
  /** @deprecated 使用 renderAssets */
  audios?: RenderAsset[];
  out: string;
}): Promise<string> => {
  const assets = opts.renderAssets ?? opts.audios ?? [];
  await mkdir(dirname(resolve(opts.out)), { recursive: true });
  const finalOut = resolve(opts.out);
  const hasAudio = assets.length > 0;
  const silentOut = hasAudio ? resolve("out/_silent.mp4") : finalOut;

  console.log("[ffmpeg] 编码画面…");
  await runFfmpeg([
    "-y",
    "-framerate",
    String(opts.meta.fps),
    "-i",
    join(opts.framesDir, "frame-%06d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    silentOut,
  ]);

  if (hasAudio) {
    await mixAudio(silentOut, assets, opts.meta.fps, opts.out);
    await rm(silentOut, { force: true });
  }

  return finalOut;
};

export { scheduleFrames } from "./frame-scheduler.js";
export type { FrameJob, FrameSchedule } from "./frame-scheduler.js";
