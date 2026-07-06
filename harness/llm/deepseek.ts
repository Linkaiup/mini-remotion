import { createChatProvider } from "./chat-provider.js";
import type { LLMProvider } from "./types.js";

export const createDeepSeekProvider = (): LLMProvider => {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) throw new Error("缺少 DEEPSEEK_API_KEY");
  const model = process.env.DEEPSEEK_MODEL ?? "deepseek-v4-pro";
  const baseURL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  return createChatProvider({
    label: "deepseek",
    apiKey,
    model,
    baseURL,
    costLabel: "timeline|compose",
  });
};
