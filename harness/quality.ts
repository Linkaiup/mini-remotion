import { spawn } from "node:child_process";
import { statSync } from "node:fs";
import { resolve } from "node:path";

export type QualityResult = {
  ok: boolean;
  score: number;
  issues: string[];
  path: string;
};

export const evaluateVideo = async (videoPath: string): Promise<QualityResult> => {
  const p = resolve(videoPath);
  const issues: string[] = [];
  let score = 1;

  try {
    const size = statSync(p).size;
    if (size < 1024) {
      issues.push(`视频过小(${size} bytes)`);
      score -= 0.5;
    }
  } catch {
    return { ok: false, score: 0, issues: ["视频文件不存在"], path: p };
  }

  try {
    const duration = await new Promise<number>((res, rej) => {
      const ff = spawn(
        "ffprobe",
        [
          "-v",
          "error",
          "-show_entries",
          "format=duration",
          "-of",
          "default=noprint_wrappers=1:nokey=1",
          p,
        ],
        { stdio: ["ignore", "pipe", "pipe"] },
      );
      let out = "";
      ff.stdout.on("data", (d: Buffer) => {
        out += d.toString();
      });
      ff.on("close", (code) => {
        if (code !== 0) rej(new Error("ffprobe failed"));
        else res(parseFloat(out.trim()) || 0);
      });
      ff.on("error", rej);
    });
    if (duration <= 0) {
      issues.push("视频时长为 0");
      score -= 0.5;
    }
  } catch (e) {
    issues.push(`ffprobe 失败: ${e}`);
    score -= 0.3;
  }

  score = Math.max(0, Math.min(1, score));
  return { ok: issues.length === 0, score, issues, path: p };
};
