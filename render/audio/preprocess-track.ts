import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { AssetVolume } from "../../src/core/volume-prop.js";
import { ffmpegVolumeExpression } from "./ffmpeg-volume-expression.js";

const CACHE_DIR = resolve("out/_audio_preprocessed");

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((res, rej) => {
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    ff.stderr.on("data", (d: Buffer) => {
      err += d.toString();
    });
    ff.on("error", rej);
    ff.on("close", (code) =>
      code === 0 ? res() : rej(new Error(err.slice(-500) || `ffmpeg ${code}`)),
    );
  });

const cacheKey = (parts: string[]): string =>
  createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 20);

/**
 * 单条音轨预处理(P4-d)。
 *
 * 对照 Remotion preprocess-audio-track:
 *   1. atrim 截取源媒体片段
 *   2. volume 应用音量曲线(常量或逐帧表达式)
 *   3. 输出 PCM WAV,供 merge-tracks 仅做 adelay + amix
 */
export const preprocessTrack = async (opts: {
  inputPath: string;
  fps: number;
  startFromInSeconds: number;
  durationInFrames: number;
  volume: AssetVolume;
}): Promise<string> => {
  const durationSec = opts.durationInFrames / opts.fps;
  const endSec = opts.startFromInSeconds + durationSec;
  const key = cacheKey([
    opts.inputPath,
    String(opts.startFromInSeconds),
    String(durationSec),
    JSON.stringify(opts.volume),
  ]);

  await mkdir(CACHE_DIR, { recursive: true });
  const outPath = resolve(CACHE_DIR, `${key}.wav`);
  if (existsSync(outPath)) return outPath;

  const vol = ffmpegVolumeExpression({
    volume: opts.volume,
    fps: opts.fps,
    trimLeft: 0,
  });

  const volumePart =
    vol.value === "1" ? "" : `,volume=${vol.value}:eval=${vol.eval}`;

  const filter =
    `[0:a]atrim=start=${opts.startFromInSeconds}:end=${endSec},` +
    `asetpts=PTS-STARTPTS${volumePart},` +
    `aresample=48000[aout]`;

  await runFfmpeg([
    "-y",
    "-hide_banner",
    "-i",
    opts.inputPath,
    "-filter_complex",
    filter,
    "-map",
    "[aout]",
    "-c:a",
    "pcm_s16le",
    outPath,
  ]);

  return outPath;
};
