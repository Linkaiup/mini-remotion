import { createHash } from "node:crypto";
import { mkdir } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const CACHE_DIR = resolve("out/_audio_cache");

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((res, rej) => {
    const ff = spawn("ffmpeg", args, { stdio: ["ignore", "pipe", "pipe"] });
    let err = "";
    ff.stderr.on("data", (d: Buffer) => {
      err += d.toString();
    });
    ff.on("error", rej);
    ff.on("close", (code) =>
      code === 0 ? res() : rej(new Error(err.slice(-400) || `ffmpeg ${code}`)),
    );
  });

const cacheKey = (videoPath: string): string =>
  createHash("sha1").update(videoPath).digest("hex").slice(0, 16);

/**
 * 从视频文件抽取音轨到缓存 AAC(P4-c)。
 * 若视频无音轨,ffmpeg 会失败 — 调用方应 catch 并跳过。
 */
export const extractAudioFromVideo = async (
  videoPath: string,
): Promise<string> => {
  await mkdir(CACHE_DIR, { recursive: true });
  const out = resolve(CACHE_DIR, `${cacheKey(videoPath)}.m4a`);

  await runFfmpeg([
    "-y",
    "-i",
    videoPath,
    "-vn",
    "-acodec",
    "aac",
    "-b:a",
    "192k",
    out,
  ]);

  return out;
};
