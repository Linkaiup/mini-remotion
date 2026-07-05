import { createChatProvider } from "./chat-provider.js";
import type { LLMProvider } from "./types.js";

export const createOpenAIProvider = (): LLMProvider => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("缺少 OPENAI_API_KEY");
  const model = process.env.OPENAI_MODEL ?? "gpt-4o-mini";
  return createChatProvider({
    label: "openai",
    apiKey,
    model,
    baseURL: process.env.OPENAI_BASE_URL,
  });
};
