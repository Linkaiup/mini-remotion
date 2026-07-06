import OpenAI from "openai";
import { recordLlmUsage } from "../cost/pricing.js";
import { llmTimeoutMs, withTimeout } from "../scheduler.js";
import type { ChatMessage, LLMProvider } from "./types.js";

export const createChatProvider = (opts: {
  label: string;
  apiKey: string;
  model: string;
  baseURL?: string;
  costLabel?: string;
}): LLMProvider => {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
  });
  const costLabel = opts.costLabel ?? opts.label;

  return {
    name: `${opts.label}:${opts.model}`,
    complete: async (messages: ChatMessage[]) => {
      const started = Date.now();
      const res = await withTimeout(
        client.chat.completions.create({
          model: opts.model,
          temperature: 0.4,
          messages,
        }),
        llmTimeoutMs(),
        `LLM ${costLabel}`,
      );
      recordLlmUsage(
        costLabel,
        opts.model,
        {
          promptTokens: res.usage?.prompt_tokens ?? 0,
          completionTokens: res.usage?.completion_tokens ?? 0,
        },
        Date.now() - started,
      );
      return res.choices[0]?.message?.content ?? "";
    },
  };
};
