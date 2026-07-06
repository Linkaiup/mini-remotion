import { spawn } from "node:child_process";
import { FrameCache } from "./frame-cache.js";

const globalCache = new FrameCache(
  Number(process.env.MINI_REMOTION_OFFTHREAD_CACHE_SIZE ?? "128"),
);

/**
 * 用 FFmpeg 从本地视频文件抽取指定时间的一帧 PNG。
 * -ss 放在 -i 之后以提高时间精度（渲染用,略慢但准）。
 */
export const extractFramePng = async (
  filePath: string,
  timeInSeconds: number,
): Promise<Buffer> => {
  const t = Math.max(0, timeInSeconds);
  const cached = globalCache.get(filePath, t);
  if (cached) return cached;

  const png = await new Promise<Buffer>((res, rej) => {
    const chunks: Buffer[] = [];
    const ff = spawn(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        filePath,
        "-ss",
        String(t),
        "-frames:v",
        "1",
        "-f",
        "image2pipe",
        "-vcodec",
        "png",
        "pipe:1",
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );

    let err = "";
    ff.stderr.on("data", (d: Buffer) => {
      err += d.toString();
    });
    ff.stdout.on("data", (d: Buffer) => chunks.push(d));
    ff.on("error", rej);
    ff.on("close", (code) => {
      if (code !== 0) {
        rej(new Error(err.trim() || `ffmpeg extract-frame exited ${code}`));
        return;
      }
      const buf = Buffer.concat(chunks);
      if (buf.length < 8) {
        rej(new Error("ffmpeg 未返回 PNG 数据"));
        return;
      }
      res(buf);
    });
  });

  globalCache.set(filePath, t, png);
  return png;
};
