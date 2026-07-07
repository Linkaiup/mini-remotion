import type { EditorProject } from "./types";
import type { EditorAgentResponse } from "../../harness/editor/agent";

/** 浏览器侧调用编辑器 Agent API */
export const callEditorAgent = async (opts: {
  project: EditorProject;
  message: string;
}): Promise<EditorAgentResponse> => {
  try {
    const res = await fetch("/api/editor/agent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        project: opts.project,
        message: opts.message,
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.json()) as EditorAgentResponse;
  } catch {
    const { runEditorAgentStub } = await import(
      "../../harness/editor/agent-stub"
    );
    return runEditorAgentStub(opts.project, opts.message);
  }
};
