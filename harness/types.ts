import type { FrameSchedule, Meta, AudioEntry } from "../render/pipeline.js";
import type { ChatMessage } from "./llm/types.js";
import type { QualityResult } from "./quality.js";
import type { VideoTimeline } from "./timeline/types.js";

/**
 * Harness Agent 流水线状态
 *
 * User Prompt → INIT → TIMELINE_PLAN → COMPOSE → VALIDATE
 *   → FRAME_SCHEDULE → CHROMIUM_POOL → FFMPEG → QUALITY_CHECK → OUTPUT → DONE
 */
export type HarnessStatus =
  | "INIT"
  | "TIMELINE_PLAN"
  | "COMPOSE"
  | "VALIDATE"
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
  minQualityScore?: number;
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
  minQualityScore: number;

  attempts: number;
  optimizeRound: number;
  enrichedPrompt: string;
  messages: ChatMessage[];
  code: string;
  providerName: string;
  tts?: { mp3Path: string; durationSeconds: number };

  /** Timeline Planning 产出 */
  timeline?: VideoTimeline;
  /** Frame Scheduler 产出 */
  frameSchedule?: FrameSchedule;
  durationHint?: number;

  lastErrors: string;
  framesDir: string;
  meta?: Meta;
  audios: AudioEntry[];
  videoPath?: string;
  quality?: QualityResult;

  renderElapsedSeconds?: number;
  error?: string;
};

export type HarnessResult = {
  status: "DONE" | "FAILED";
  codePath: string;
  videoPath?: string;
  manifestPath?: string;
  timeline?: VideoTimeline;
  provider: string;
  attempts: number;
  quality?: QualityResult;
  tts?: HarnessContext["tts"];
  error?: string;
};
