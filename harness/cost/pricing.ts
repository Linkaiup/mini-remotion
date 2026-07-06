import type { CostTracker } from "./tracker.js";
import { getActiveCostTracker } from "./tracker.js";

/** 每 1M token 美元单价(可用 env 覆盖, 仅估算) */
const llmPricePer1M = (model: string): { in: number; out: number } => {
  const key = model.toLowerCase();
  if (key.includes("flash")) return { in: 0.14, out: 0.28 };
  if (key.includes("deepseek")) return { in: 0.27, out: 1.1 };
  if (key.includes("gpt-4o-mini")) return { in: 0.15, out: 0.6 };
  if (key.includes("gpt-4o")) return { in: 2.5, out: 10 };
  const inPrice = Number(process.env.LLM_PRICE_INPUT_PER_1M ?? "0.5");
  const outPrice = Number(process.env.LLM_PRICE_OUTPUT_PER_1M ?? "1.5");
  return { in: inPrice, out: outPrice };
};

export const estimateLlmUsd = (
  model: string,
  promptTokens: number,
  completionTokens: number,
): number => {
  const p = llmPricePer1M(model);
  return (
    (promptTokens / 1_000_000) * p.in +
    (completionTokens / 1_000_000) * p.out
  );
};

export const estimateImageUsd = (count = 1): number => {
  const per = Number(process.env.SEEDREAM_COST_USD ?? "0.04");
  return per * count;
};

export const recordLlmUsage = (
  label: string,
  model: string,
  usage: { promptTokens: number; completionTokens: number },
  latencyMs: number,
  tracker: CostTracker | null = getActiveCostTracker(),
): void => {
  if (!tracker) return;
  tracker.record({
    kind: "llm",
    label,
    promptTokens: usage.promptTokens,
    completionTokens: usage.completionTokens,
    estimatedUsd: estimateLlmUsd(
      model,
      usage.promptTokens,
      usage.completionTokens,
    ),
    latencyMs,
  });
};

export const recordImageUsage = (
  label: string,
  count: number,
  tracker: CostTracker | null = getActiveCostTracker(),
): void => {
  if (!tracker) return;
  tracker.record({
    kind: "image",
    label,
    units: count,
    estimatedUsd: estimateImageUsd(count),
  });
};

export const recordTtsUsage = (
  label: string,
  tracker: CostTracker | null = getActiveCostTracker(),
): void => {
  if (!tracker) return;
  tracker.record({
    kind: "tts",
    label,
    units: 1,
    estimatedUsd: Number(process.env.TTS_COST_USD ?? "0"),
  });
};
