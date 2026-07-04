/**
 * 导出脚本(渲染层的"导出"分支 + 驱动层的"循环推进"策略)。
 *
 * 前置条件(可选功能,需额外安装):
 *   npm install -D puppeteer
 *   并确保系统已安装 ffmpeg(mac: brew install ffmpeg)
 *
 * 用法:
 *   1) 另开终端启动 dev server: npm run dev
 *   2) npm run render -- --comp DraftDemo --out out/video.mp4 --concurrency 4
 *
 * 原理:
 *   1) 把 0..N 帧切成若干段,开多个浏览器页面【并行】渲染各自的段并截图。
 *      —— 因为 frame→画面 是纯函数(无共享状态、确定性),各段可独立渲染任意帧,
 *         这就是并发渲染成立的根本前提,也是 Remotion 性能的核心红利。
 *   2) FFmpeg 把帧序列编码成"无声视频"。
 *   3) 若有音频,按时间线(adelay 定位 + atrim 裁剪 + volume 调音 + amix 混合)离线混流。
 */
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { cpus } from "node:os";
import { dirname, join, resolve } from "node:path";

type Args = {
  comp: string;
  out: string;
  url: string;
  concurrency: number;
  propsB64: string;
};

type Meta = {
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

type AudioEntry = {
  id: string;
  src: string;
  startInFrames: number;
  durationInFrames: number;
  startFromInSeconds: number;
  volume: number;
};

const parseArgs = (): Args => {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const defaultConcurrency = Math.min(4, Math.max(1, cpus().length));

  // --props 接受两种形式:直接 JSON 字符串,或已 base64 的串(Studio 复制的命令)
  const rawProps = get("props", "");
  let propsB64 = "";
  if (rawProps) {
    const looksJson = rawProps.trim().startsWith("{");
    propsB64 = looksJson
      ? Buffer.from(rawProps, "utf-8").toString("base64")
      : rawProps;
  }

  return {
    comp: get("comp", "CodeDemo"),
    out: get("out", "out/video.mp4"),
    url: get("url", "http://localhost:5173"),
    concurrency: Math.max(1, Number(get("concurrency", String(defaultConcurrency)))),
    propsB64,
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

// staticFile 的 "/audio.mp3" -> 本地 public/audio.mp3
const resolveAsset = (src: string): string =>
  resolve("public", src.replace(/^\//, ""));

// 把 [0, total) 切成 count 个连续区间
const splitRanges = (total: number, count: number): [number, number][] => {
  const n = Math.min(count, total);
  const size = Math.ceil(total / n);
  const ranges: [number, number][] = [];
  for (let start = 0; start < total; start += size) {
    ranges.push([start, Math.min(start + size, total)]);
  }
  return ranges;
};

const mixAudio = async (
  silentVideo: string,
  audios: AudioEntry[],
  fps: number,
  out: string,
): Promise<void> => {
  const inputs: string[] = ["-i", silentVideo];
  const chains: string[] = [];
  const labels: string[] = [];

  audios.forEach((a, k) => {
    const inputIndex = k + 1; // 0 是视频
    inputs.push("-i", resolveAsset(a.src));

    const startSec = a.startFromInSeconds;
    const endSec = a.startFromInSeconds + a.durationInFrames / fps;
    const delayMs = Math.round((a.startInFrames / fps) * 1000);
    const label = `a${k}`;

    chains.push(
      `[${inputIndex}:a]atrim=start=${startSec}:end=${endSec},` +
        `asetpts=PTS-STARTPTS,adelay=${delayMs}|${delayMs},` +
        `volume=${a.volume}[${label}]`,
    );
    labels.push(`[${label}]`);
  });

  const filterComplex =
    audios.length === 1
      ? `${chains[0]};[a0]anull[aout]`
      : `${chains.join(";")};${labels.join("")}amix=inputs=${audios.length}:normalize=0[aout]`;

  await runFfmpeg([
    "-y",
    ...inputs,
    "-filter_complex",
    filterComplex,
    "-map",
    "0:v",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    resolve(out),
  ]);
};

// puppeteer 启动参数(关闭后台节流,保底)
const LAUNCH_ARGS = [
  "--disable-background-timer-throttling",
  "--disable-backgrounding-occluded-windows",
  "--disable-renderer-backgrounding",
];

// 渲染一个连续帧区间 [start, end):每段【独立开一个浏览器进程】。
// 这样每个进程都有自己的前台页面,requestAnimationFrame 正常触发,互不干扰。
// 语义上等价于"把不同帧段分给不同机器渲染" —— 这正是确定性带来的可分布式红利。
const renderChunk = async (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  puppeteer: any,
  args: {
    url: string;
    comp: string;
    range: [number, number];
    propsB64: string;
  },
  framesDir: string,
  audioMap: Map<string, AudioEntry>,
  onFrameDone: () => void,
): Promise<Meta> => {
  const { url, comp, range, propsB64 } = args;
  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 60000,
    args: LAUNCH_ARGS,
  });
  const page = await browser.newPage();
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

    // 等两帧,确保新挂载的 <Img> 先 delayRender() 把 ready 置 false,避免抢跑
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
    for (const a of frameAudios) audioMap.set(a.id, a);

    await canvas.screenshot({
      path: join(framesDir, `frame-${String(i).padStart(6, "0")}.png`),
    });
    onFrameDone();
  }

  await browser.close();
  return meta;
};

const main = async () => {
  const { comp, out, url, concurrency, propsB64 } = parseArgs();

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

  // 关键:多个页面并行时,Chrome 默认会"节流"后台标签页的 requestAnimationFrame/定时器,
  // 导致非前台页面的等待逻辑卡死。下面这几个 flag 关闭后台节流,让所有页面全速渲染。
  // 先用一个探测浏览器读取总帧数,以便切分区间
  const probeBrowser = await puppeteer.launch({
    headless: true,
    args: LAUNCH_ARGS,
  });
  const probe = await probeBrowser.newPage();
  await probe.goto(`${url}/?headless=1&comp=${encodeURIComponent(comp)}`, {
    waitUntil: "networkidle0",
  });
  await probe.waitForFunction(() => Boolean(window.__miniRemotionMeta), {
    timeout: 15000,
  });
  const probeMeta = (await probe.evaluate(
    () => window.__miniRemotionMeta!,
  )) as Meta;
  await probeBrowser.close();

  const ranges = splitRanges(probeMeta.durationInFrames, concurrency);
  console.log(
    `[mini-remotion] ${comp}: ${probeMeta.width}×${probeMeta.height} @ ${probeMeta.fps}fps, ` +
      `${probeMeta.durationInFrames} 帧 → ${ranges.length} 段并行(concurrency=${concurrency})`,
  );

  const audioMap = new Map<string, AudioEntry>();
  let done = 0;
  const total = probeMeta.durationInFrames;
  const onFrameDone = () => {
    done++;
    if (done % 15 === 0 || done === total) {
      process.stdout.write(`\r[mini-remotion] 截图 ${done}/${total}`);
    }
  };

  const started = Date.now();

  // 每个区间开一个独立浏览器进程,并行渲染
  const metas = await Promise.all(
    ranges.map((range) =>
      renderChunk(
        puppeteer,
        { url, comp, range, propsB64 },
        framesDir,
        audioMap,
        onFrameDone,
      ),
    ),
  );
  process.stdout.write("\n");

  const meta = metas[0];
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[mini-remotion] 并行截图完成,用时 ${elapsed}s`);

  const audios = Array.from(audioMap.values());
  const hasAudio = audios.length > 0;
  const finalOut = resolve(out);
  const silentOut = hasAudio ? resolve("out/_silent.mp4") : finalOut;

  console.log("[mini-remotion] FFmpeg 编码画面…");
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
    silentOut,
  ]);

  if (hasAudio) {
    console.log(`[mini-remotion] 混流 ${audios.length} 条音频(时间线离线合成)…`);
    await mixAudio(silentOut, audios, meta.fps, out);
    await rm(silentOut, { force: true });
  }

  console.log(`[mini-remotion] ✅ 导出完成: ${finalOut}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
