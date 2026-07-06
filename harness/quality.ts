import { statSync } from "node:fs";
import { resolve } from "node:path";
import { evaluateVisualQA, type VisualQAResult } from "./quality/visual-qa.js";
import { evaluateVisionLLM, type VisionQAResult } from "./quality/vision-llm.js";

export type QualityResult = {
  ok: boolean;
  score: number;
  issues: string[];
  path: string;
  /** 亮度启发式子结果 */
  visual?: VisualQAResult;
  /** Vision LLM 子结果(启用时) */
  vision?: VisionQAResult;
};

const probeTechnical = async (videoPath: string): Promise<{
  issues: string[];
  score: number;
}> => {
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
    return { issues: ["视频文件不存在"], score: 0 };
  }

  const { spawn } = await import("node:child_process");
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

  return { issues, score: Math.max(0, Math.min(1, score)) };
};

/** 技术检查(ffprobe) + 视觉 QA(亮度) + 可选 Vision LLM */
export const evaluateVideo = async (
  videoPath: string,
  opts?: { prompt?: string },
): Promise<QualityResult> => {
  const p = resolve(videoPath);
  const tech = await probeTechnical(p);
  const visual = await evaluateVisualQA(p);
  const vision = await evaluateVisionLLM(p, { prompt: opts?.prompt });

  const issues = [...tech.issues, ...visual.issues];
  if (vision) {
    issues.push(...vision.issues.map((i) => `[vision] ${i}`));
  }

  // 权重: 技术 25% + 亮度 35% + Vision 40%(未启用时亮度占满剩余)
  const visualWeight = vision ? 0.35 : 0.65;
  const visionWeight = vision ? 0.4 : 0;
  const score = Math.max(
    0,
    Math.min(
      1,
      tech.score * 0.25 +
        visual.score * visualWeight +
        (vision?.score ?? 0) * visionWeight,
    ),
  );

  return {
    ok: issues.length === 0,
    score,
    issues,
    path: p,
    visual,
    vision: vision ?? undefined,
  };
};
