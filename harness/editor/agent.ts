/**
 * 编辑器 Agent — 自然语言增量修改 EditorProject。
 * 优先走 LLM（需 .env API key）；失败时回退规则 stub。
 */
import { randomUUID } from "node:crypto";
import { selectProvider } from "../llm/index.js";
import type { ChatMessage } from "../llm/types.js";
import type { EditorPatch, EditorProject } from "../../src/editor/types.js";
import { runEditorAgentStub } from "./agent-stub.js";
import { EDITOR_AGENT_SYSTEM } from "./prompts.js";

export type EditorAgentRequest = {
  project: EditorProject;
  message: string;
  history?: ChatMessage[];
};

export type EditorAgentResponse = {
  reply: string;
  patch: EditorPatch | null;
};

const extractJson = (raw: string): EditorPatch | null => {
  const match = raw.match(/```json\s*([\s\S]*?)```/);
  const text = match ? match[1] : raw;
  try {
    const parsed = JSON.parse(text.trim()) as EditorPatch;
    if (parsed && Array.isArray(parsed.ops)) return parsed;
  } catch {
    /* try find object */
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        const parsed = JSON.parse(raw.slice(start, end + 1)) as EditorPatch;
        if (parsed && Array.isArray(parsed.ops)) return parsed;
      } catch {
        return null;
      }
    }
  }
  return null;
};

export const runEditorAgent = async (
  req: EditorAgentRequest,
): Promise<EditorAgentResponse> => {
  const stub = runEditorAgentStub(req.project, req.message);
  if (stub.patch) return stub;

  try {
    const provider = selectProvider();
    if (provider.name === "stub") return stub;

    const messages: ChatMessage[] = [
      { role: "system", content: EDITOR_AGENT_SYSTEM },
      ...(req.history ?? []),
      {
        role: "user",
        content: `## 当前项目 JSON\n\`\`\`json\n${JSON.stringify(req.project, null, 2)}\n\`\`\`\n\n## 用户指令\n${req.message}\n\n请输出修改方案。`,
      },
    ];

    const raw = await provider.complete(messages);
    const patch = extractJson(raw);
    const reply =
      patch?.summary ??
      (raw.replace(/```json[\s\S]*?```/g, "").trim().slice(0, 500) ||
        "已生成修改方案，请确认。");

    return { reply, patch };
  } catch (e) {
    return {
      reply: `Agent 调用失败，已尝试规则匹配：${e instanceof Error ? e.message : e}`,
      patch: stub.patch,
    };
  }
};

export const newMessageId = (): string => randomUUID().slice(0, 8);
