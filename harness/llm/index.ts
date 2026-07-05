import { createDeepSeekProvider } from "./deepseek.js";
import { createOpenAIProvider } from "./openai.js";
import { createStubProvider } from "./stub.js";
import type { LLMProvider } from "./types.js";

export type { ChatMessage, LLMProvider } from "./types.js";

export const selectProvider = (): LLMProvider => {
  const explicit = process.env.MINI_REMOTION_PROVIDER;
  if (explicit === "stub") return createStubProvider();
  if (explicit === "deepseek") return createDeepSeekProvider();
  if (explicit === "openai") return createOpenAIProvider();
  if (process.env.DEEPSEEK_API_KEY) return createDeepSeekProvider();
  if (process.env.OPENAI_API_KEY) return createOpenAIProvider();
  console.log("[harness] 未检测到 DEEPSEEK_API_KEY,使用 stub provider");
  return createStubProvider();
};
