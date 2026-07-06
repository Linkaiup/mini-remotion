import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { ensureRenderSite } from "../../engine/render-site.js";
import { ensureOffthreadServer } from "../../render/offthread/index.js";
import { buildHeadlessUrl } from "../../render/headless-url.js";
import { sampleFramesForTimeline } from "../validate-plan.js";
import type { VideoTimeline } from "../timeline/types.js";

export type PreviewResult = {
  ok: boolean;
  score: number;
  issues: string[];
  framesDir: string;
};

const frameBrightness = (pngPath: string): Promise<number> =>
  new Promise((res, rej) => {
    const ff = spawn(
      "ffmpeg",
      ["-i", pngPath, "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    ff.stdout.on("data", (d: Buffer) => chunks.push(d));
    ff.on("close", (code: number | null) => {
      if (code !== 0) return rej(new Error("亮度分析失败"));
      res(Buffer.concat(chunks)[0] ?? 128);
    });
    ff.on("error", rej);
  });

/** 低清抽帧预览(半分辨率), 全量渲染前快速质检 */
export const runPreviewCheck = async (
  timeline: VideoTimeline,
  opts?: { scale?: number },
): Promise<PreviewResult> => {
  const scale = opts?.scale ?? 0.5;
  const previewW = Math.round(timeline.width * scale);
  const previewH = Math.round(timeline.height * scale);
  const framesDir = resolve("out/preview-frames");
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });

  const baseUrl = await ensureRenderSite();
  const offthread = await ensureOffthreadServer();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let puppeteer: any;
  try {
    puppeteer = await import("puppeteer" as string);
  } catch {
    return { ok: false, score: 0, issues: ["需要 puppeteer"], framesDir };
  }

  process.env.PUPPETEER_CACHE_DIR = resolve(".puppeteer-cache");
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 30000,
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });

  const issues: string[] = [];
  let score = 1;
  const sampleFrames = sampleFramesForTimeline(timeline);

  try {
    const page = await browser.newPage();
    const url = `${buildHeadlessUrl({
      baseUrl,
      comp: "GeneratedVideo",
      proxyPort: offthread.port,
    })}&_t=${Date.now()}`;
    await page.goto(url, { waitUntil: "networkidle0", timeout: 20000 });
    await page.waitForFunction(() => Boolean(window.__miniRemotionMeta), {
      timeout: 15000,
    });
    await page.setViewport({ width: previewW, height: previewH });

    for (const frame of sampleFrames) {
      await page.evaluate((f: number) => window.__miniRemotionSetFrame?.(f), frame);
      await page.evaluate(
        () =>
          new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          ),
      );
      await page.waitForFunction(() => window.__miniRemotionReady === true, {
        timeout: 10000,
      });
      const png = join(framesDir, `preview-${String(frame).padStart(4, "0")}.png`);
      const canvas = await page.$("#mini-remotion-canvas");
      if (!canvas) {
        issues.push(`帧 ${frame}: 无 canvas`);
        score -= 0.3;
        continue;
      }
      await canvas.screenshot({ path: png });
      const brightness = await frameBrightness(png);
      if (brightness < 6) {
        issues.push(`预览帧 ${frame} 疑似黑屏 (亮度 ${brightness})`);
        score -= 0.25;
      } else if (brightness > 252) {
        issues.push(`预览帧 ${frame} 疑似空白 (亮度 ${brightness})`);
        score -= 0.2;
      }
    }
  } catch (e) {
    issues.push(e instanceof Error ? e.message : String(e));
    score = 0;
  } finally {
    await browser.close();
  }

  score = Math.max(0, Math.min(1, score));
  return { ok: issues.length === 0, score, issues, framesDir };
};
