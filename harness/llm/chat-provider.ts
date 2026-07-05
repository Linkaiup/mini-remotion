import OpenAI from "openai";
import type { ChatMessage, LLMProvider } from "./types.js";

export const createChatProvider = (opts: {
  label: string;
  apiKey: string;
  model: string;
  baseURL?: string;
}): LLMProvider => {
  const client = new OpenAI({
    apiKey: opts.apiKey,
    baseURL: opts.baseURL,
  });
  return {
    name: `${opts.label}:${opts.model}`,
    complete: async (messages: ChatMessage[]) => {
      const res = await client.chat.completions.create({
        model: opts.model,
        temperature: 0.4,
        messages,
      });
      return res.choices[0]?.message?.content ?? "";
    },
  };
};
