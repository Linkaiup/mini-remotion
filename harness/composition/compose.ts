import { extractCode } from "../code.js";
import { selectProvider } from "../llm/index.js";
import { harnessLog } from "../log.js";
import type { ChatMessage } from "../llm/types.js";
import type { VideoTimeline } from "../timeline/types.js";
import {
  COMPOSITION_SYSTEM_PROMPT,
  buildCompositionUserMessage,
} from "./prompts.js";

export type ComposeResult = {
  code: string;
  messages: ChatMessage[];
};

/** React Composition: 根据时间线生成 TSX */
export const composeFromTimeline = async (
  prompt: string,
  timeline: VideoTimeline,
  priorMessages?: ChatMessage[],
): Promise<ComposeResult> => {
  const messages: ChatMessage[] = priorMessages ?? [
    { role: "system", content: COMPOSITION_SYSTEM_PROMPT },
    buildCompositionUserMessage(prompt, timeline),
  ];

  const provider = selectProvider();
  harnessLog("COMPOSE", `LLM 生成 React 组件 (${provider.name})…`);

  const raw = await provider.complete(messages);
  const code = extractCode(raw);
  messages.push({ role: "assistant", content: raw });

  harnessLog("COMPOSE", `   已生成 ${code.split("\n").length} 行 TSX`);
  return { code, messages };
};

export const initCompositionMessages = (
  prompt: string,
  timeline: VideoTimeline,
): ChatMessage[] => [
  { role: "system", content: COMPOSITION_SYSTEM_PROMPT },
  buildCompositionUserMessage(prompt, timeline),
];
