/**
 * Harness Agent — 流水线状态机
 *
 * User Prompt → Timeline Planning → Asset Gen (Seedream) → React Composition
 *   → Validate → Frame Scheduler → Chromium Pool → FFmpeg → Quality Check → Output
 */
import { resolve } from "node:path";
import { ensureRenderSite } from "../engine/render-site.js";
import {
  captureFramesWithPool,
  encodeCompositionVideo,
  probeMeta,
  scheduleFrames,
} from "../engine/render-job.js";
import { synthSpeech, selectTTSBackend } from "../engine/tts/index.js";
import {
  attachAssetsToTimeline,
  generateTimelineAssets,
} from "./assets/generate.js";
import {
  hashPrompt,
  loadHarnessCache,
  mergeHarnessCache,
} from "./cache/llm-cache.js";
import {
  composeFromTimeline,
  initCompositionMessages,
} from "./composition/compose.js";
import { enrichPromptWithTts } from "./composition/prompts.js";
import { recordTtsUsage } from "./cost/pricing.js";
import {
  CostTracker,
  setActiveCostTracker,
} from "./cost/tracker.js";
import {
  optimizeReasonLabel,
  parseFailureKind,
  targetAfterOptimize,
  type FailureKind,
} from "./failure-router.js";
import { selectProvider } from "./llm/index.js";
import { harnessFail, harnessLog } from "./log.js";
import { finalizeOutput } from "./output.js";
import { evaluateVideo } from "./quality.js";
import {
  getSchedulerHints,
  optimizeConcurrency,
  pickPoolSize,
  renderTimeoutMs,
  withTimeout,
} from "./scheduler.js";
import { exportDraft } from "./draft/export.js";
import { runPreviewCheck } from "./preview/frame-preview.js";
import { planTimeline } from "./timeline/plan.js";
import type { HarnessContext, HarnessOptions, HarnessResult } from "./types.js";
import { appendRepairMessage, validatePlan } from "./validate-plan.js";

const log = harnessLog;

const setFailure = (
  ctx: HarnessContext,
  stage: string,
  errors: string,
): void => {
  ctx.lastErrors = errors;
  ctx.lastFailureKind = parseFailureKind(stage);
  ctx.error = `[${stage}] ${errors}`;
};

const assertBudget = (ctx: HarnessContext, label: string): void => {
  try {
    ctx.costTracker.assertWithinBudget(ctx.maxBudgetUsd);
  } catch (e) {
    throw new Error(`${label}: ${e instanceof Error ? e.message : e}`);
  }
};

const initContext = (opts: HarnessOptions): HarnessContext => {
  const provider = selectProvider();
  const costTracker = new CostTracker();
  const promptHash = hashPrompt([
    opts.prompt,
    opts.narration ?? "",
    String(opts.noImages),
  ]);

  const concurrency = pickPoolSize({ requested: opts.concurrency });

  return {
    status: "INIT",
    prompt: opts.prompt,
    narration: opts.narration,
    out: opts.out ?? "out/agent-video.mp4",
    maxRetries: opts.maxRetries ?? 3,
    concurrency,
    skipRender: opts.skipRender ?? false,
    noTts: opts.noTts ?? false,
    noImages: opts.noImages ?? false,
    minQualityScore: opts.minQualityScore ?? 0.5,
    maxBudgetUsd: opts.maxBudgetUsd,
    useCache: opts.useCache ?? true,
    templateId: opts.templateId,
    skipPreview: opts.skipPreview ?? false,
    promptHash,
    costTracker,
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

const logSchedulerHints = (): void => {
  const h = getSchedulerHints();
  log(
    "INIT",
    `   资源: ${h.cpuCores} 核, 空闲内存 ${h.freeMemGb.toFixed(1)}GB / ${h.totalMemGb.toFixed(1)}GB`,
  );
};

const stepInit = async (ctx: HarnessContext): Promise<void> => {
  log("INIT", "Harness Agent 启动");
  logSchedulerHints();
  if (ctx.maxBudgetUsd) {
    log("INIT", `   预算上限 $${ctx.maxBudgetUsd.toFixed(4)}`);
  }

  const ttsBackend = selectTTSBackend();
  if (
    ctx.narration &&
    !ctx.noTts &&
    ttsBackend.name !== "noop"
  ) {
    try {
      log("INIT", `TTS 合成 (${ttsBackend.name})…`);
      const tts = await synthSpeech(ctx.narration, "narration");
      ctx.tts = tts;
      recordTtsUsage(tts.backend, ctx.costTracker);
      ctx.enrichedPrompt = enrichPromptWithTts(
        ctx.prompt,
        tts.mp3Path,
        tts.durationSeconds,
      );
      ctx.durationHint = Math.ceil(tts.durationSeconds * 30);
      log("INIT", `   旁白 ${tts.durationSeconds.toFixed(1)}s → ${ctx.durationHint} 帧`);
    } catch (e) {
      log("INIT", `   TTS 跳过: ${e}`);
    }
  }

  ctx.status = "TIMELINE_PLAN";
};

const stepTimelinePlan = async (ctx: HarnessContext): Promise<void> => {
  log("TIMELINE_PLAN", "规划分镜时间线…");

  if (ctx.useCache) {
    const cached = await loadHarnessCache(ctx.promptHash);
    if (cached?.timeline) {
      ctx.timeline = cached.timeline;
      log(
        "TIMELINE_PLAN",
        `   缓存命中 → ${ctx.timeline.scenes.length} 场景`,
      );
      ctx.status = "ASSET_GEN";
      return;
    }
  }

  assertBudget(ctx, "TIMELINE_PLAN");
  ctx.timeline = await planTimeline(ctx.enrichedPrompt, {
    durationInFrames: ctx.durationHint,
    templateId: ctx.templateId,
  });
  for (const s of ctx.timeline.scenes) {
    log("TIMELINE_PLAN", `   [${s.startFrame}-${s.endFrame}] ${s.label}: ${s.description.slice(0, 40)}`);
  }
  await mergeHarnessCache(ctx.promptHash, { timeline: ctx.timeline });
  ctx.status = "ASSET_GEN";
};

const stepAssetGen = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.timeline) {
    ctx.status = "FAILED";
    ctx.error = "缺少 timeline";
    return;
  }

  try {
    assertBudget(ctx, "ASSET_GEN");
    const result = await generateTimelineAssets(ctx.timeline, {
      forceSkip: ctx.noImages,
    });
    ctx.resolvedAssets = result.assets;
    if (!result.skipped && result.assets.length > 0) {
      ctx.timeline = attachAssetsToTimeline(ctx.timeline, result.assets);
      log("ASSET_GEN", `   已挂载 ${result.assets.length} 张图到时间线`);
    }
    ctx.messages = initCompositionMessages(ctx.enrichedPrompt, ctx.timeline);
    ctx.status = "COMPOSE";
  } catch (e) {
    setFailure(ctx, "asset", String(e));
    harnessFail("ASSET_GEN", "素材生成失败", ctx.lastErrors);
    ctx.status =
      ctx.attempts < ctx.maxRetries ? "OPTIMIZE" : "FAILED";
  }
};

const stepCompose = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.timeline) {
    ctx.status = "FAILED";
    ctx.error = "缺少 timeline";
    return;
  }

  ctx.attempts += 1;
  log("COMPOSE", `React Composition (${ctx.attempts}/${ctx.maxRetries})…`);

  if (ctx.useCache && ctx.optimizeRound === 0 && ctx.attempts === 1) {
    const cached = await loadHarnessCache(ctx.promptHash);
    if (cached?.code && cached.validatedAt) {
      ctx.code = cached.code;
      ctx.messages = initCompositionMessages(ctx.enrichedPrompt, ctx.timeline);
      log("COMPOSE", `   缓存命中 TSX (${ctx.code.split("\n").length} 行)`);
      ctx.status = "VALIDATE";
      return;
    }
  }

  assertBudget(ctx, "COMPOSE");
  const { code, messages } = await composeFromTimeline(
    ctx.enrichedPrompt,
    ctx.timeline,
    ctx.messages.length > 0 ? ctx.messages : undefined,
  );
  ctx.code = code;
  ctx.messages = messages;
  log(
    "COMPOSE",
    `   成本累计 $${ctx.costTracker.totalUsd.toFixed(4)}`,
  );
  ctx.status = "VALIDATE";
};

const stepValidate = async (ctx: HarnessContext): Promise<void> => {
  const result = await validatePlan(ctx);
  if (!result.ok) {
    setFailure(ctx, result.stage, result.errors);
    const retryLeft = ctx.maxRetries - ctx.attempts;
    if (retryLeft > 0) {
      log(
        "VALIDATE",
        `将重试 → ${targetAfterOptimize(ctx.lastFailureKind!)} (剩余 ${retryLeft})`,
      );
      ctx.status = "OPTIMIZE";
    } else {
      harnessFail("VALIDATE", `已达最大重试 (${ctx.maxRetries}), 终止`, result.errors);
      ctx.status = "FAILED";
    }
    return;
  }

  log("VALIDATE", "全部通过 ✓");
  await mergeHarnessCache(ctx.promptHash, {
    timeline: ctx.timeline,
    code: ctx.code,
    validatedAt: new Date().toISOString(),
  });

  if (ctx.skipRender) {
    ctx.status = "OUTPUT";
  } else if (ctx.skipPreview) {
    ctx.status = "FRAME_SCHEDULE";
  } else {
    ctx.status = "PREVIEW_CHECK";
  }
};

const stepPreviewCheck = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.timeline) {
    ctx.status = "FRAME_SCHEDULE";
    return;
  }

  log("PREVIEW_CHECK", "低清抽帧预览 (50% 分辨率)…");
  const preview = await runPreviewCheck(ctx.timeline);
  ctx.preview = preview;

  log(
    "PREVIEW_CHECK",
    `   评分 ${preview.score.toFixed(2)} (${preview.ok ? "通过" : "有问题"})`,
  );
  if (preview.issues.length) {
    for (const issue of preview.issues.slice(0, 4)) {
      log("PREVIEW_CHECK", `   · ${issue}`);
    }
  }

  if (!preview.ok || preview.score < ctx.minQualityScore) {
    const detail = preview.issues.join("\n");
    if (ctx.attempts < ctx.maxRetries) {
      setFailure(ctx, "preview", detail);
      harnessFail("PREVIEW_CHECK", "预览未通过, 跳过全量渲染", detail);
      ctx.status = "OPTIMIZE";
      return;
    }
    log("PREVIEW_CHECK", "预览未通过, 已达重试上限, 继续全量渲染");
  }

  ctx.status = "FRAME_SCHEDULE";
};

const stepFrameSchedule = async (ctx: HarnessContext): Promise<void> => {
  log("FRAME_SCHEDULE", "探测 meta + 切分帧任务…");
  const url = await ensureRenderSite();
  try {
    const meta = await probeMeta({ comp: "GeneratedVideo", url });
    ctx.meta = meta;
    ctx.concurrency = pickPoolSize({
      requested: ctx.concurrency,
      totalFrames: meta.durationInFrames,
    });
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
    setFailure(ctx, "render", String(e));
    harnessFail("FRAME_SCHEDULE", "调度失败", ctx.lastErrors);
    ctx.status = ctx.attempts < ctx.maxRetries ? "OPTIMIZE" : "FAILED";
  }
};

const stepChromiumPool = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.frameSchedule) {
    ctx.status = "FAILED";
    ctx.error = "缺少 frameSchedule";
    return;
  }

  log("CHROMIUM_POOL", `并行截图 pool=${ctx.frameSchedule.poolSize}…`);
  const url = await ensureRenderSite();

  try {
    const timeout = renderTimeoutMs(ctx.frameSchedule.totalFrames);
    log("CHROMIUM_POOL", `   超时上限 ${(timeout / 1000).toFixed(0)}s`);
    const captured = await withTimeout(
      captureFramesWithPool({
        comp: "GeneratedVideo",
        url,
        schedule: ctx.frameSchedule,
        framesDir: ctx.framesDir,
      }),
      timeout,
      "CHROMIUM_POOL",
    );
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
    setFailure(ctx, "render", String(e));
    harnessFail("CHROMIUM_POOL", "截图失败", ctx.lastErrors);
    ctx.status = ctx.attempts < ctx.maxRetries ? "OPTIMIZE" : "FAILED";
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
    setFailure(ctx, "encode", String(e));
    harnessFail("FFMPEG", "编码失败", ctx.lastErrors);
    ctx.status = ctx.attempts < ctx.maxRetries ? "OPTIMIZE" : "FAILED";
  }
};

const stepQualityCheck = async (ctx: HarnessContext): Promise<void> => {
  if (!ctx.videoPath) {
    ctx.status = "OUTPUT";
    return;
  }

  log("QUALITY_CHECK", "技术检查 + 视觉 QA…");
  ctx.quality = await evaluateVideo(ctx.videoPath, { prompt: ctx.prompt });

  const visualNote = ctx.quality.visual
    ? `, 视觉 ${ctx.quality.visual.score.toFixed(2)}`
    : "";
  log(
    "QUALITY_CHECK",
    `   综合 ${ctx.quality.score.toFixed(2)}${visualNote} (${ctx.quality.ok ? "通过" : "有问题"})`,
  );
  if (ctx.quality.visual?.issues.length) {
    for (const issue of ctx.quality.visual.issues.slice(0, 4)) {
      log("QUALITY_CHECK", `   · ${issue}`);
    }
  }
  if (ctx.quality.vision) {
    log(
      "QUALITY_CHECK",
      `   Vision(${ctx.quality.vision.provider}) ${ctx.quality.vision.score.toFixed(2)}: ${ctx.quality.vision.summary || "—"}`,
    );
  }

  if (!ctx.quality.ok || ctx.quality.score < ctx.minQualityScore) {
    const detail = ctx.quality.issues.join("\n");
    if (ctx.attempts < ctx.maxRetries) {
      setFailure(ctx, "visual", detail);
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

type HarnessContextWithResult = HarnessContext & {
  finalResult?: HarnessResult;
};

const stepOutput = async (ctx: HarnessContextWithResult): Promise<void> => {
  let draftPath: string | undefined;
  if (ctx.timeline) {
    const exported = await exportDraft(ctx.timeline, ctx.prompt);
    draftPath = exported.draftPath;
  }

  ctx.finalResult = await finalizeOutput(ctx, {
    codePath: resolve("src/generated/current.tsx"),
    videoPath: ctx.videoPath,
    provider: ctx.providerName,
    attempts: ctx.attempts,
    quality: ctx.quality,
    cost: ctx.costTracker.summary(),
    preview: ctx.preview,
    tts: ctx.tts,
    timeline: ctx.timeline,
    assets: ctx.resolvedAssets,
    draftPath,
  });
  ctx.status = "DONE";
};

const stepOptimize = async (ctx: HarnessContext): Promise<void> => {
  ctx.optimizeRound += 1;
  const kind: FailureKind = ctx.lastFailureKind ?? "static";

  if (kind === "render" || kind === "encode") {
    ctx.concurrency = optimizeConcurrency(ctx.concurrency, "render");
  }

  const next = targetAfterOptimize(kind);
  log(
    "OPTIMIZE",
    `第 ${ctx.optimizeRound} 轮 [${optimizeReasonLabel(kind)}] → ${next}`,
  );

  if (
    ctx.lastErrors &&
    ctx.code &&
    ctx.messages.length > 0 &&
    (next === "COMPOSE" || kind === "visual" || kind === "preview")
  ) {
    appendRepairMessage(ctx, ctx.lastErrors);
  }

  ctx.status = next;
};

export const runHarness = async (opts: HarnessOptions): Promise<HarnessResult> => {
  const ctx = initContext(opts) as HarnessContextWithResult;
  setActiveCostTracker(ctx.costTracker);

  try {
    while (ctx.status !== "DONE" && ctx.status !== "FAILED") {
      switch (ctx.status) {
        case "INIT":
          await stepInit(ctx);
          break;
        case "TIMELINE_PLAN":
          await stepTimelinePlan(ctx);
          break;
        case "ASSET_GEN":
          await stepAssetGen(ctx);
          break;
        case "COMPOSE":
          await stepCompose(ctx);
          break;
        case "VALIDATE":
          await stepValidate(ctx);
          break;
        case "PREVIEW_CHECK":
          await stepPreviewCheck(ctx);
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
  } finally {
    setActiveCostTracker(null);
  }
};
