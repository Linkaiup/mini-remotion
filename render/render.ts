/**
 * 导出脚本(渲染层的"导出"分支 + 驱动层的"循环推进"策略)。
 *
 * 前置条件(可选功能,需额外安装):
 *   npm install -D puppeteer
 *   并确保系统已安装 ffmpeg(mac: brew install ffmpeg)
 *
 * 用法:
 *   1) 另开终端启动 dev server: npm run dev
 *   2) npm run render -- --comp CodeDemo --out out/video.mp4
 *
 * 原理:Puppeteer 打开 headless 页面,循环调用 window.__miniRemotionSetFrame(i),
 * 等待就绪后逐帧截图为 PNG,最后交给 FFmpeg 编码成 mp4。
 * 这与真实 Remotion 的渲染管线完全同构(只是它用 Rust compositor 更高效)。
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";

type Args = { comp: string; out: string; url: string };

const parseArgs = (): Args => {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  return {
    comp: get("comp", "CodeDemo"),
    out: get("out", "out/video.mp4"),
    url: get("url", "http://localhost:5173"),
  };
};

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((res, rej) => {
    const ff = spawn("ffmpeg", args, { stdio: "inherit" });
    ff.on("error", rej);
    ff.on("close", (code: number | null) =>
      code === 0 ? res() : rej(new Error(`ffmpeg exited with ${code}`)),
    );
  });

const main = async () => {
  const { comp, out, url } = parseArgs();

  // puppeteer 为可选依赖,用 any 避免在未安装时的类型报错
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let puppeteer: any;
  try {
    puppeteer = await import("puppeteer" as string);
  } catch {
    console.error(
      "\n[mini-remotion] 需要 puppeteer 才能导出。请先运行:\n  npm install -D puppeteer\n",
    );
    process.exit(1);
  }

  const framesDir = resolve("out/frames");
  await rm(framesDir, { recursive: true, force: true });
  await mkdir(framesDir, { recursive: true });
  await mkdir(dirname(resolve(out)), { recursive: true });

  const browser = await puppeteer.launch({ headless: true });
  const page = await browser.newPage();

  const target = `${url}/?headless=1&comp=${encodeURIComponent(comp)}`;
  console.log(`[mini-remotion] 打开 ${target}`);
  await page.goto(target, { waitUntil: "networkidle0" });

  // 读取 composition 元信息
  await page.waitForFunction(() => Boolean(window.__miniRemotionMeta), {
    timeout: 15000,
  });
  const meta = (await page.evaluate(() => window.__miniRemotionMeta!)) as {
    width: number;
    height: number;
    fps: number;
    durationInFrames: number;
  };

  await page.setViewport({ width: meta.width, height: meta.height });
  console.log(
    `[mini-remotion] ${comp}: ${meta.width}×${meta.height} @ ${meta.fps}fps, ${meta.durationInFrames} 帧`,
  );

  const canvas = await page.$("#mini-remotion-canvas");
  if (!canvas) throw new Error("找不到 #mini-remotion-canvas");

  for (let i = 0; i < meta.durationInFrames; i++) {
    // 驱动层:推进到第 i 帧
    await page.evaluate((frame: number) => {
      window.__miniRemotionSetFrame?.(frame);
    }, i);

    // 等待 React 提交 + 异步资源就绪(delayRender 机制)
    await page.evaluate(
      () =>
        new Promise<void>((r) => requestAnimationFrame(() => r())),
    );
    await page.waitForFunction(() => window.__miniRemotionReady === true, {
      timeout: 15000,
    });

    await canvas.screenshot({
      path: join(framesDir, `frame-${String(i).padStart(6, "0")}.png`),
    });

    if (i % 15 === 0 || i === meta.durationInFrames - 1) {
      process.stdout.write(
        `\r[mini-remotion] 截图 ${i + 1}/${meta.durationInFrames}`,
      );
    }
  }
  process.stdout.write("\n");
  await browser.close();

  console.log("[mini-remotion] FFmpeg 编码中…");
  await runFfmpeg([
    "-y",
    "-framerate",
    String(meta.fps),
    "-i",
    join(framesDir, "frame-%06d.png"),
    "-c:v",
    "libx264",
    "-pix_fmt",
    "yuv420p",
    resolve(out),
  ]);

  console.log(`[mini-remotion] ✅ 导出完成: ${resolve(out)}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
