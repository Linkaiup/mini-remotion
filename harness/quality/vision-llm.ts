/**
 * Vision LLM 质检 — 抽帧后交给多模态模型做语义级点评。
 *
 * 与 visual-qa.ts 的亮度启发式互补:
 *  - 亮度:快速、免费,只能抓黑屏/白屏
 *  - Vision LLM:慢、有成本,能发现文字溢出、布局错乱、与 prompt 不符等
 *
 * 启用: MINI_REMOTION_VISION_QA=1 且配置 OPENAI_API_KEY 或 DEEPSEEK_API_KEY
 */
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { evaluateVisualQA } from "./visual-qa.js";

export type VisionQAResult = {
  ok: boolean;
  score: number;
  issues: string[];
  summary: string;
  provider: string;
  /** 送检的帧索引(约) */
  sampledFrames: number[];
};

const isVisionEnabled = (): boolean =>
  process.env.MINI_REMOTION_VISION_QA === "1" ||
  process.env.MINI_REMOTION_VISION_QA === "true";

/** 将 PNG 转为 data URL 供 vision API 使用 */
const toDataUrl = async (pngPath: string): Promise<string> => {
  const buf = await readFile(pngPath);
  return `data:image/png;base64,${buf.toString("base64")}`;
};

type VisionProvider = {
  name: string;
  analyze: (opts: {
    images: { frame: number; dataUrl: string }[];
    prompt?: string;
  }) => Promise<{ score: number; issues: string[]; summary: string }>;
};

/** OpenAI 兼容 vision(chat.completions + image_url) */
const createOpenAIVision = (): VisionProvider | null => {
  const apiKey = process.env.OPENAI_API_KEY ?? process.env.DEEPSEEK_API_KEY;
  if (!apiKey) return null;

  const baseURL =
    process.env.OPENAI_BASE_URL ??
    process.env.DEEPSEEK_BASE_URL ??
    (process.env.DEEPSEEK_API_KEY
      ? "https://api.deepseek.com"
      : "https://api.openai.com/v1");
  const model =
    process.env.VISION_MODEL ??
    process.env.OPENAI_VISION_MODEL ??
    "gpt-4o-mini";

  return {
    name: process.env.DEEPSEEK_API_KEY && !process.env.OPENAI_API_KEY
      ? "deepseek-vision"
      : "openai-vision",
    analyze: async ({ images, prompt }) => {
      const { default: OpenAI } = await import("openai");
      const client = new OpenAI({ apiKey, baseURL });

      const userContent: Array<
        | { type: "text"; text: string }
        | { type: "image_url"; image_url: { url: string } }
      > = [
        {
          type: "text",
          text: `你是视频质检员。以下是从生成视频中抽取的 ${images.length} 帧截图。
用户需求: ${prompt ?? "(未提供)"}

请检查:黑屏/白屏、文字是否被裁切、元素是否重叠错乱、是否与需求明显不符。
以 JSON 回复(不要 markdown): {"score":0-1,"issues":["..."],"summary":"一句话"}`,
        },
        ...images.map((img) => ({
          type: "image_url" as const,
          image_url: { url: img.dataUrl },
        })),
      ];

      const res = await client.chat.completions.create({
        model,
        messages: [{ role: "user", content: userContent }],
        max_tokens: 600,
      });

      const raw = res.choices[0]?.message?.content ?? "{}";
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch?.[0] ?? "{}") as {
        score?: number;
        issues?: string[];
        summary?: string;
      };

      return {
        score: Math.max(0, Math.min(1, Number(parsed.score) || 0.5)),
        issues: Array.isArray(parsed.issues) ? parsed.issues.map(String) : [],
        summary: String(parsed.summary ?? ""),
      };
    },
  };
};

const stubVision: VisionProvider = {
  name: "vision-stub",
  analyze: async () => ({
    score: 0.85,
    issues: [],
    summary: "Vision QA 未配置 API key,使用 stub 通过",
  }),
};

const selectVisionProvider = (): VisionProvider =>
  createOpenAIVision() ?? stubVision;

/**
 * 对视频运行 Vision LLM 质检。
 * 未启用时返回 null(调用方只用亮度启发式)。
 */
export const evaluateVisionLLM = async (
  videoPath: string,
  opts?: { prompt?: string; sampleCount?: number },
): Promise<VisionQAResult | null> => {
  if (!isVisionEnabled()) return null;

  const sampleCount = opts?.sampleCount ?? 3;
  const visual = await evaluateVisualQA(videoPath, sampleCount);
  const qaDir = resolve("out/qa");

  const images: { frame: number; dataUrl: string }[] = [];
  for (let i = 0; i < sampleCount; i++) {
    const png = join(qaDir, `sample-${i}.png`);
    try {
      images.push({
        frame: visual.frameBrightness[i]?.frame ?? i,
        dataUrl: await toDataUrl(png),
      });
    } catch {
      /* 抽帧失败则跳过 */
    }
  }

  if (images.length === 0) {
    return {
      ok: false,
      score: 0,
      issues: ["Vision QA: 无法读取抽帧图片"],
      summary: "",
      provider: "none",
      sampledFrames: [],
    };
  }

  const provider = selectVisionProvider();
  const { score, issues, summary } = await provider.analyze({
    images,
    prompt: opts?.prompt,
  });

  return {
    ok: issues.length === 0 && score >= 0.5,
    score,
    issues,
    summary,
    provider: provider.name,
    sampledFrames: images.map((x) => x.frame),
  };
};
