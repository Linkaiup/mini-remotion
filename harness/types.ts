import type { AudioEntry, Meta } from "../render/pipeline.js";
import type { ChatMessage } from "./llm/types.js";
import type { QualityResult } from "./quality.js";

/** Harness 状态机状态 */
export type HarnessStatus =
  | "INIT"
  | "PLAN"
  | "VALIDATE_PLAN"
  | "RENDER_FRAMES"
  | "ENCODE_VIDEO"
  | "EVALUATE"
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

  lastErrors: string;
  framesDir: string;
  meta?: Meta;
  audios: AudioEntry[];
  videoPath?: string;
  quality?: QualityResult;

  /** 渲染阶段耗时(秒),用于 OPTIMIZE 决策 */
  renderElapsedSeconds?: number;
  error?: string;
};

export type HarnessResult = {
  status: "DONE" | "FAILED";
  codePath: string;
  videoPath?: string;
  provider: string;
  attempts: number;
  quality?: QualityResult;
  tts?: HarnessContext["tts"];
  error?: string;
};
