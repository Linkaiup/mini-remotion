import type { CostSummary, CostTracker } from "./cost/tracker.js";
import type { FrameSchedule, Meta, RenderAsset } from "../render/pipeline.js";
import type { ResolvedAsset } from "./assets/types.js";
import type { ChatMessage } from "./llm/types.js";
import type { FailureKind } from "./failure-router.js";
import type { QualityResult } from "./quality.js";
import type { VideoTimeline } from "./timeline/types.js";

/**
 * Harness Agent 流水线状态
 *
 * User Prompt → INIT → TIMELINE_PLAN → ASSET_GEN → COMPOSE → VALIDATE
 *   → FRAME_SCHEDULE → CHROMIUM_POOL → FFMPEG → QUALITY_CHECK → OUTPUT → DONE
 */
export type HarnessStatus =
  | "INIT"
  | "TIMELINE_PLAN"
  | "ASSET_GEN"
  | "COMPOSE"
  | "VALIDATE"
  | "PREVIEW_CHECK"
  | "FRAME_SCHEDULE"
  | "CHROMIUM_POOL"
  | "FFMPEG"
  | "QUALITY_CHECK"
  | "OUTPUT"
  | "OPTIMIZE"
  | "DONE"
  | "FAILED";

export type HarnessOptions = {
  prompt: string;
  narration?: string;
  out?: string;
  maxRetries?: number;
  concurrency?: number;
  skipRender?: boolean;
  noTts?: boolean;
  noImages?: boolean;
  minQualityScore?: number;
  maxBudgetUsd?: number;
  useCache?: boolean;
  templateId?: string;
  skipPreview?: boolean;
};

export type HarnessContext = {
  status: HarnessStatus;
  prompt: string;
  narration?: string;
  out: string;
  maxRetries: number;
  concurrency: number;
  skipRender: boolean;
  noTts: boolean;
  noImages: boolean;
  minQualityScore: number;
  maxBudgetUsd?: number;
  useCache: boolean;
  templateId?: string;
  skipPreview: boolean;
  promptHash: string;
  costTracker: CostTracker;

  attempts: number;
  optimizeRound: number;
  enrichedPrompt: string;
  messages: ChatMessage[];
  code: string;
  providerName: string;
  tts?: { mp3Path: string; durationSeconds: number; backend?: string };

  timeline?: VideoTimeline;
  resolvedAssets?: ResolvedAsset[];
  frameSchedule?: FrameSchedule;
  durationHint?: number;

  lastErrors: string;
  lastFailureKind?: FailureKind;
  framesDir: string;
  meta?: Meta;
  renderAssets: RenderAsset[];
  videoPath?: string;
  quality?: QualityResult;
  preview?: { ok: boolean; score: number; issues: string[] };

  renderElapsedSeconds?: number;
  error?: string;
};

export type HarnessResult = {
  status: "DONE" | "FAILED";
  codePath: string;
  videoPath?: string;
  manifestPath?: string;
  draftPath?: string;
  timeline?: VideoTimeline;
  assets?: ResolvedAsset[];
  provider: string;
  attempts: number;
  quality?: QualityResult;
  cost?: CostSummary;
  preview?: HarnessContext["preview"];
  tts?: HarnessContext["tts"];
  error?: string;
};
