/**
 * Harness Agent — TypeScript 轻量状态机。
 *
 * 状态: INIT → PLAN → VALIDATE_PLAN → RENDER_FRAMES → ENCODE_VIDEO → EVALUATE → DONE
 *       失败恢复: VALIDATE_PLAN / EVALUATE → OPTIMIZE → PLAN
 *       终态: DONE | FAILED
 *
 * React(src/) = 画面 | Node(engine/ + render/) = 渲染 | harness/ = 编排
 */
import { resolve } from "node:path";
import { ensureDevServer } from "../engine/dev-server.js";
import { captureCompositionFrames, encodeCompositionVideo } from "../engine/render-job.js";
import { synthTTS } from "../engine/tts-job.js";
import { extractCode } from "./code.js";
import { selectProvider } from "./llm/index.js";
import {
  SYSTEM_PROMPT,
  buildUserMessage,
  enrichPromptWithTts,
} from "./prompts.js";
import { evaluateVideo } from "./quality.js";
import { optimizeConcurrency, pickConcurrency } from "./scheduler.js";
import type {
  HarnessContext,
  HarnessOptions,
  HarnessResult,
} from "./types.js";
import {
  appendRepairMessage,
  validatePlan,
} from "./validate-plan.js";
import { harnessFail, harnessLog } from "./log.js";

const log = harnessLog;

const initContext = (opts: HarnessOptions): HarnessContext => {
  const provider = selectProvider();
  return {
    status: "INIT",
    prompt: opts.prompt,
    narration: opts.narration,
    out: opts.out ?? "out/agent-video.mp4",
    maxRetries: opts.maxRetries ?? 3,
    concurrency: pickConcurrency(opts.concurrency),
    skipRender: opts.skipRender ?? false,
    noTts: opts.noTts ?? false,
    minQualityScore: opts.minQualityScore ?? 0.5,
    attempts: 0,
    optimizeRound: 0,
    enrichedPrompt: opts.prompt,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: buildUserMessage(opts.prompt).content },
    ],
    code: "",
    providerName: provider.name,
    lastErrors: "",
    framesDir: resolve("out/frames"),
    audios: [],
  };
};

const stepInit = async (ctx: HarnessContext): Promise<void> => {
  log("INIT", "初始化 Harness 上下文");

  if (ctx.narration && !ctx.noTts && process.env.MINI_REMOTION_TTS !== "noop") {
    try {
      log("INIT", "TTS 合成旁白…");
      ctx.tts = await synthTTS(ctx.narration, "narration");
      ctx.enrichedPrompt = enrichPromptWithTts(
        ctx.prompt,
        ctx.tts.mp3Path,
        ctx.tts.durationSeconds,
      );
      ctx.messages[1] = buildUserMessage(ctx.enrichedPrompt);
    } catch (e) {
      log("INIT", `TTS 跳过: ${e}`);
    }
  }

  ctx.status = "PLAN";
};

const stepPlan = async (ctx: HarnessContext): Promise<void> => {
  ctx.attempts += 1;
  log("PLAN", `LLM 生成 TSX (${ctx.attempts}/${ctx.maxRetries}, ${ctx.providerName})…`);

  const provider = selectProvider();
  const raw = await provider.complete(ctx.messages);
  ctx.code = extractCode(raw);
  ctx.messages.push({ role: "assistant", content: raw });
  log("PLAN", `   已生成 ${ctx.code.split("\n").length} 行代码`);

  ctx.status = "VALIDATE_PLAN";
};

const stepValidatePlan = async (ctx: HarnessContext): Promise<void> => {
  const result = await validatePlan(ctx);
  if (!result.ok) {
    ctx.lastErrors = result.errors;
    appendRepairMessage(ctx, result.errors);
    const retryLeft = ctx.maxRetries - ctx.attempts;
    if (retryLeft > 0) {
      log("VALIDATE_PLAN", `将重试, 剩余 ${retryLeft} 次`);
      ctx.status = "OPTIMIZE";
    } else {
      harnessFail("VALIDATE_PLAN", `已达最大重试 (${ctx.maxRetries}), 终止`, result.errors);
      ctx.status = "FAILED";
    }
    ctx.error = `[${result.stage}] ${ctx.lastErrors}`;
    return;
  }

  log("VALIDATE_PLAN", "全部通过 ✓");
  if (ctx.skipRender) {
    ctx.status = "DONE";
  } else {
    ctx.status = "RENDER_FRAMES";
  }
};

const stepRenderFrames = async (ctx: HarnessContext): Promise<void> => {
  log("RENDER_FRAMES", `Chromium 逐帧截图 (concurrency=${ctx.concurrency})`);
  await ensureDevServer();

  try {
    const captured = await captureCompositionFrames({
      comp: "GeneratedVideo",
      concurrency: ctx.concurrency,
    });
    ctx.meta = captured.meta;
    ctx.framesDir = captured.framesDir;
    ctx.audios = captured.audios;
    ctx.renderElapsedSeconds = captured.elapsedSeconds;
    log("RENDER_FRAMES", `完成 ${captured.elapsedSeconds.toFixed(1)}s, ${captured.meta.durationInFrames} 帧`);
    ctx.status = "ENCODE_VIDEO";
  } catch (e) {
    ctx.lastErrors = String(e);
    ctx.error = ctx.lastErrors;
    harnessFail("RENDER_FRAMES", "截图失败", ctx.lastErrors);
    ctx.status = ctx.attempts >= ctx.maxRetries ? "FAILED" : "OPTIMIZE";
  }
};

const stepEncodeVideo = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.meta) {
    harnessFail("ENCODE_VIDEO", "缺少 meta, 无法编码");
    ctx.status = "FAILED";
    ctx.error = "缺少 meta,无法编码";
    return;
  }

  log("ENCODE_VIDEO", "FFmpeg 编码 + 音频混流");
  try {
    ctx.videoPath = await encodeCompositionVideo({
      meta: ctx.meta,
      framesDir: ctx.framesDir,
      audios: ctx.audios,
      out: ctx.out,
    });
    log("ENCODE_VIDEO", `完成 → ${ctx.videoPath}`);
    ctx.status = "EVALUATE";
  } catch (e) {
    ctx.lastErrors = String(e);
    ctx.error = ctx.lastErrors;
    harnessFail("ENCODE_VIDEO", "编码失败", ctx.lastErrors);
    ctx.status = ctx.attempts >= ctx.maxRetries ? "FAILED" : "OPTIMIZE";
  }
};

const stepEvaluate = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.videoPath) {
    ctx.status = "DONE";
    return;
  }

  log("EVALUATE", "质量评测(ffprobe)");
  ctx.quality = await evaluateVideo(ctx.videoPath);
  log(
    "EVALUATE",
    `评分 ${ctx.quality.score.toFixed(2)} (${ctx.quality.ok ? "通过" : "有问题"})`,
  );

  if (
    !ctx.quality.ok ||
    ctx.quality.score < ctx.minQualityScore
  ) {
    const detail = ctx.quality.issues.join("\n");
    if (ctx.attempts < ctx.maxRetries) {
      ctx.lastErrors = detail;
      harnessFail("EVALUATE", `质量未达标 (${ctx.quality.score.toFixed(2)} < ${ctx.minQualityScore})`, detail);
      ctx.status = "OPTIMIZE";
      return;
    }
    harnessFail("EVALUATE", "质量未达标且已达最大重试", detail);
  }

  ctx.status = "DONE";
};

const stepOptimize = async (ctx: HarnessContext): Promise<void> => {
  ctx.optimizeRound += 1;
  const reason = ctx.meta ? "quality" : ctx.renderElapsedSeconds ? "render" : "validate";
  ctx.concurrency = optimizeConcurrency(ctx.concurrency, reason);

  log(
    "OPTIMIZE",
    `第 ${ctx.optimizeRound} 轮 → concurrency=${ctx.concurrency}, 回 PLAN (${reason})`,
  );

  if (ctx.lastErrors && ctx.code) {
    appendRepairMessage(ctx, ctx.lastErrors);
  }

  ctx.status = "PLAN";
};

export const runHarness = async (opts: HarnessOptions): Promise<HarnessResult> => {
  const ctx = initContext(opts);

  while (ctx.status !== "DONE" && ctx.status !== "FAILED") {
    switch (ctx.status) {
      case "INIT":
        await stepInit(ctx);
        break;
      case "PLAN":
        await stepPlan(ctx);
        break;
      case "VALIDATE_PLAN":
        await stepValidatePlan(ctx);
        break;
      case "RENDER_FRAMES":
        await stepRenderFrames(ctx);
        break;
      case "ENCODE_VIDEO":
        await stepEncodeVideo(ctx);
        break;
      case "EVALUATE":
        await stepEvaluate(ctx);
        break;
      case "OPTIMIZE":
        await stepOptimize(ctx);
        break;
      default:
        ctx.status = "FAILED";
        ctx.error = `未知状态: ${ctx.status}`;
    }
  }

  if (ctx.status === "FAILED") {
    throw new Error(ctx.error ?? "Harness 失败");
  }

  return {
    status: "DONE",
    codePath: resolve("src/generated/current.tsx"),
    videoPath: ctx.videoPath,
    provider: ctx.providerName,
    attempts: ctx.attempts,
    quality: ctx.quality,
    tts: ctx.tts,
  };
};
