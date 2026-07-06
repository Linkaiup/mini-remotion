import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { join, resolve } from "node:path";

export type VisualQAResult = {
  ok: boolean;
  score: number;
  issues: string[];
  frameBrightness: { frame: number; brightness: number }[];
};

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((res, rej) => {
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    ff.stderr.on("data", (d: Buffer) => {
      err += d.toString();
    });
    ff.on("close", (code) =>
      code === 0 ? res() : rej(new Error(err.slice(-500) || `ffmpeg ${code}`)),
    );
    ff.on("error", rej);
  });

/** 从视频指定时间点抽一帧 */
const extractFrameAt = async (
  videoPath: string,
  seconds: number,
  outPng: string,
): Promise<void> => {
  await runFfmpeg([
    "-y",
    "-ss",
    String(seconds),
    "-i",
    resolve(videoPath),
    "-frames:v",
    "1",
    "-q:v",
    "2",
    outPng,
  ]);
};

/** 缩放到 1x1 灰度, 取平均亮度 0–255 */
const frameBrightness = (pngPath: string): Promise<number> =>
  new Promise((res, rej) => {
    const ff = spawn(
      "ffmpeg",
      ["-i", pngPath, "-vf", "scale=1:1", "-f", "rawvideo", "-pix_fmt", "gray", "pipe:1"],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    const chunks: Buffer[] = [];
    ff.stdout.on("data", (d: Buffer) => chunks.push(d));
    ff.on("close", (code) => {
      if (code !== 0) return rej(new Error("亮度分析失败"));
      const buf = Buffer.concat(chunks);
      res(buf[0] ?? 128);
    });
    ff.on("error", rej);
  });

const probeDuration = (videoPath: string): Promise<number> =>
  new Promise((res, rej) => {
    const ff = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        videoPath,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    ff.stdout.on("data", (d: Buffer) => {
      out += d.toString();
    });
    ff.on("close", (code) => {
      if (code !== 0) return rej(new Error("ffprobe failed"));
      res(parseFloat(out.trim()) || 0);
    });
    ff.on("error", rej);
  });

/** 视觉 QA: 抽帧 + 黑屏/白屏检测 */
export const evaluateVisualQA = async (
  videoPath: string,
  sampleCount = 5,
): Promise<VisualQAResult> => {
  const issues: string[] = [];
  let score = 1;
  const qaDir = resolve("out/qa");
  await rm(qaDir, { recursive: true, force: true });
  await mkdir(qaDir, { recursive: true });

  const duration = await probeDuration(videoPath);
  if (duration <= 0) {
    return {
      ok: false,
      score: 0,
      issues: ["无法读取视频时长"],
      frameBrightness: [],
    };
  }

  const samples: { frame: number; brightness: number }[] = [];
  const positions = Array.from({ length: sampleCount }, (_, i) => {
    const t = ((i + 1) / (sampleCount + 1)) * duration;
    return Math.max(0, t);
  });

  for (let i = 0; i < positions.length; i++) {
    const png = join(qaDir, `sample-${i}.png`);
    await extractFrameAt(videoPath, positions[i], png);
    const brightness = await frameBrightness(png);
    const frameIndex = Math.round(positions[i] * 30);
    samples.push({ frame: frameIndex, brightness });

    if (brightness < 6) {
      issues.push(`帧 ~${frameIndex} 疑似黑屏 (亮度 ${brightness})`);
      score -= 0.25;
    } else if (brightness > 252) {
      issues.push(`帧 ~${frameIndex} 疑似白屏/空白 (亮度 ${brightness})`);
      score -= 0.2;
    }
  }

  const avg =
    samples.reduce((s, x) => s + x.brightness, 0) / (samples.length || 1);
  if (avg < 8) {
    issues.push(`全片平均亮度过低 (${avg.toFixed(0)})`);
    score -= 0.3;
  }

  score = Math.max(0, Math.min(1, score));
  return {
    ok: issues.length === 0,
    score,
    issues,
    frameBrightness: samples,
  };
};
