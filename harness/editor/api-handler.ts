import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv } from "../../config/env.js";
import { runEditorAgent } from "./agent.js";

loadEnv();

export const handleEditorAgentApi = async (
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> => {
  if (req.method !== "POST") {
    res.statusCode = 405;
    res.end(JSON.stringify({ error: "POST only" }));
    return;
  }

  let body = "";
  for await (const chunk of req) body += chunk;

  try {
    const { project, message, history } = JSON.parse(body) as {
      project: Parameters<typeof runEditorAgent>[0]["project"];
      message: string;
      history?: Parameters<typeof runEditorAgent>[0]["history"];
    };

    const result = await runEditorAgent({ project, message, history });
    res.setHeader("Content-Type", "application/json");
    res.end(JSON.stringify(result));
  } catch (e) {
    res.statusCode = 400;
    res.end(
      JSON.stringify({
        error: e instanceof Error ? e.message : String(e),
      }),
    );
  }
};
