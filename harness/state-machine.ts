/**
 * Harness Agent — 流水线状态机
 *
 * User Prompt → Harness Agent → Timeline Planning → React Composition
 *   → Frame Scheduler → Chromium Pool → FFmpeg → Quality Check → Output
 */
import { resolve } from "node:path";
import { ensureDevServer } from "../engine/dev-server.js";
import {
  captureFramesWithPool,
  encodeCompositionVideo,
  probeMeta,
  scheduleFrames,
} from "../engine/render-job.js";
import { synthTTS } from "../engine/tts-job.js";
import {
  composeFromTimeline,
  initCompositionMessages,
} from "./composition/compose.js";
import { enrichPromptWithTts } from "./composition/prompts.js";
import { selectProvider } from "./llm/index.js";
import { harnessFail, harnessLog } from "./log.js";
import { finalizeOutput } from "./output.js";
import { evaluateVideo } from "./quality.js";
import { optimizeConcurrency, pickConcurrency } from "./scheduler.js";
import { planTimeline } from "./timeline/plan.js";
import type { HarnessContext, HarnessOptions, HarnessResult } from "./types.js";
import { appendRepairMessage, validatePlan } from "./validate-plan.js";

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
    messages: [],
    code: "",
    providerName: provider.name,
    lastErrors: "",
    framesDir: resolve("out/frames"),
    audios: [],
  };
};

const stepInit = async (ctx: HarnessContext): Promise<void> => {
  log("INIT", "Harness Agent 启动");

  if (ctx.narration && !ctx.noTts && process.env.MINI_REMOTION_TTS !== "noop") {
    try {
      log("INIT", "TTS 合成旁白…");
      ctx.tts = await synthTTS(ctx.narration, "narration");
      ctx.enrichedPrompt = enrichPromptWithTts(
        ctx.prompt,
        ctx.tts.mp3Path,
        ctx.tts.durationSeconds,
      );
      ctx.durationHint = Math.ceil(ctx.tts.durationSeconds * 30);
      log("INIT", `   旁白 ${ctx.tts.durationSeconds.toFixed(1)}s → ${ctx.durationHint} 帧`);
    } catch (e) {
      log("INIT", `   TTS 跳过: ${e}`);
    }
  }

  ctx.status = "TIMELINE_PLAN";
};

const stepTimelinePlan = async (ctx: HarnessContext): Promise<void> => {
  log("TIMELINE_PLAN", "规划分镜时间线…");
  ctx.timeline = await planTimeline(ctx.enrichedPrompt, {
    durationInFrames: ctx.durationHint,
  });
  for (const s of ctx.timeline.scenes) {
    log("TIMELINE_PLAN", `   [${s.startFrame}-${s.endFrame}] ${s.label}: ${s.description.slice(0, 40)}`);
  }
  ctx.messages = initCompositionMessages(ctx.enrichedPrompt, ctx.timeline);
  ctx.status = "COMPOSE";
};

const stepCompose = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.timeline) {
    ctx.status = "FAILED";
    ctx.error = "缺少 timeline";
    return;
  }

  ctx.attempts += 1;
  log("COMPOSE", `React Composition (${ctx.attempts}/${ctx.maxRetries})…`);

  const { code, messages } = await composeFromTimeline(
    ctx.enrichedPrompt,
    ctx.timeline,
    ctx.messages.length > 0 ? ctx.messages : undefined,
  );
  ctx.code = code;
  ctx.messages = messages;
  ctx.status = "VALIDATE";
};

const stepValidate = async (ctx: HarnessContext): Promise<void> => {
  const result = await validatePlan(ctx);
  if (!result.ok) {
    ctx.lastErrors = result.errors;
    const retryLeft = ctx.maxRetries - ctx.attempts;
    if (retryLeft > 0) {
      log("VALIDATE", `将重试 COMPOSE, 剩余 ${retryLeft} 次`);
      ctx.status = "OPTIMIZE";
    } else {
      harnessFail("VALIDATE", `已达最大重试 (${ctx.maxRetries}), 终止`, result.errors);
      ctx.status = "FAILED";
    }
    ctx.error = `[${result.stage}] ${ctx.lastErrors}`;
    return;
  }

  log("VALIDATE", "全部通过 ✓");
  ctx.status = ctx.skipRender ? "OUTPUT" : "FRAME_SCHEDULE";
};

const stepFrameSchedule = async (ctx: HarnessContext): Promise<void> => {
  log("FRAME_SCHEDULE", "探测 meta + 切分帧任务…");
  await ensureDevServer();

  const url = process.env.MINI_REMOTION_DEV_URL ?? "http://localhost:5173";
  try {
    const meta = await probeMeta({ comp: "GeneratedVideo", url });
    ctx.meta = meta;
    ctx.frameSchedule = scheduleFrames(meta, ctx.concurrency);
    for (const job of ctx.frameSchedule.jobs) {
      log(
        "FRAME_SCHEDULE",
        `   job#${job.id} 帧 ${job.range[0]}–${job.range[1]} (${job.frameCount} 帧)`,
      );
    }
    log(
      "FRAME_SCHEDULE",
      `   共 ${ctx.frameSchedule.totalFrames} 帧, pool=${ctx.frameSchedule.poolSize}`,
    );
    ctx.status = "CHROMIUM_POOL";
  } catch (e) {
    ctx.lastErrors = String(e);
    ctx.error = ctx.lastErrors;
    harnessFail("FRAME_SCHEDULE", "调度失败", ctx.lastErrors);
    ctx.status = ctx.attempts >= ctx.maxRetries ? "FAILED" : "OPTIMIZE";
  }
};

const stepChromiumPool = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.frameSchedule) {
    ctx.status = "FAILED";
    ctx.error = "缺少 frameSchedule";
    return;
  }

  log("CHROMIUM_POOL", `并行截图 pool=${ctx.frameSchedule.poolSize}…`);
  const url = process.env.MINI_REMOTION_DEV_URL ?? "http://localhost:5173";

  try {
    const captured = await captureFramesWithPool({
      comp: "GeneratedVideo",
      url,
      schedule: ctx.frameSchedule,
      framesDir: ctx.framesDir,
    });
    ctx.meta = captured.meta;
    ctx.framesDir = captured.framesDir;
    ctx.audios = captured.audios;
    ctx.renderElapsedSeconds = captured.elapsedSeconds;
    log(
      "CHROMIUM_POOL",
      `   完成 ${captured.elapsedSeconds.toFixed(1)}s, ${captured.meta.durationInFrames} 帧`,
    );
    ctx.status = "FFMPEG";
  } catch (e) {
    ctx.lastErrors = String(e);
    ctx.error = ctx.lastErrors;
    harnessFail("CHROMIUM_POOL", "截图失败", ctx.lastErrors);
    ctx.status = ctx.attempts >= ctx.maxRetries ? "FAILED" : "OPTIMIZE";
  }
};

const stepFfmpeg = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.meta) {
    harnessFail("FFMPEG", "缺少 meta, 无法编码");
    ctx.status = "FAILED";
    ctx.error = "缺少 meta";
    return;
  }

  log("FFMPEG", "编码 + 音频混流…");
  try {
    ctx.videoPath = await encodeCompositionVideo({
      meta: ctx.meta,
      framesDir: ctx.framesDir,
      audios: ctx.audios,
      out: ctx.out,
    });
    log("FFMPEG", `   完成 → ${ctx.videoPath}`);
    ctx.status = "QUALITY_CHECK";
  } catch (e) {
    ctx.lastErrors = String(e);
    ctx.error = ctx.lastErrors;
    harnessFail("FFMPEG", "编码失败", ctx.lastErrors);
    ctx.status = ctx.attempts >= ctx.maxRetries ? "FAILED" : "OPTIMIZE";
  }
};

const stepQualityCheck = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.videoPath) {
    ctx.status = "OUTPUT";
    return;
  }

  log("QUALITY_CHECK", "ffprobe 评测…");
  ctx.quality = await evaluateVideo(ctx.videoPath);
  log(
    "QUALITY_CHECK",
    `   评分 ${ctx.quality.score.toFixed(2)} (${ctx.quality.ok ? "通过" : "有问题"})`,
  );

  if (!ctx.quality.ok || ctx.quality.score < ctx.minQualityScore) {
    const detail = ctx.quality.issues.join("\n");
    if (ctx.attempts < ctx.maxRetries) {
      ctx.lastErrors = detail;
      harnessFail(
        "QUALITY_CHECK",
        `质量未达标 (${ctx.quality.score.toFixed(2)} < ${ctx.minQualityScore})`,
        detail,
      );
      ctx.status = "OPTIMIZE";
      return;
    }
    harnessFail("QUALITY_CHECK", "质量未达标且已达最大重试", detail);
  }

  ctx.status = "OUTPUT";
};

// extend context for output step
type HarnessContextWithResult = HarnessContext & {
  finalResult?: HarnessResult;
};

const stepOutput = async (ctx: HarnessContextWithResult): Promise<void> => {
  ctx.finalResult = await finalizeOutput(ctx, {
    codePath: resolve("src/generated/current.tsx"),
    videoPath: ctx.videoPath,
    provider: ctx.providerName,
    attempts: ctx.attempts,
    quality: ctx.quality,
    tts: ctx.tts,
    timeline: ctx.timeline,
  });
  ctx.status = "DONE";
};

const stepOptimize = async (ctx: HarnessContext): Promise<void> => {
  ctx.optimizeRound += 1;
  const reason = ctx.meta && ctx.quality ? "quality" : ctx.renderElapsedSeconds ? "render" : "validate";
  ctx.concurrency = optimizeConcurrency(ctx.concurrency, reason);

  log(
    "OPTIMIZE",
    `第 ${ctx.optimizeRound} 轮 → pool=${ctx.concurrency}, 回 COMPOSE (${reason})`,
  );

  if (ctx.lastErrors && ctx.code && ctx.messages.length > 0) {
    appendRepairMessage(ctx, ctx.lastErrors);
  }

  ctx.status = "COMPOSE";
};

export const runHarness = async (opts: HarnessOptions): Promise<HarnessResult> => {
  const ctx = initContext(opts) as HarnessContextWithResult;

  while (ctx.status !== "DONE" && ctx.status !== "FAILED") {
    switch (ctx.status) {
      case "INIT":
        await stepInit(ctx);
        break;
      case "TIMELINE_PLAN":
        await stepTimelinePlan(ctx);
        break;
      case "COMPOSE":
        await stepCompose(ctx);
        break;
      case "VALIDATE":
        await stepValidate(ctx);
        break;
      case "FRAME_SCHEDULE":
        await stepFrameSchedule(ctx);
        break;
      case "CHROMIUM_POOL":
        await stepChromiumPool(ctx);
        break;
      case "FFMPEG":
        await stepFfmpeg(ctx);
        break;
      case "QUALITY_CHECK":
        await stepQualityCheck(ctx);
        break;
      case "OUTPUT":
        await stepOutput(ctx);
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

  return ctx.finalResult!;
};
