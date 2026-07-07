import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { handleEditorAgentApi } from "./harness/editor/api-handler";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "editor-agent-api",
      configureServer(server) {
        server.middlewares.use(async (req, res, next) => {
          if (req.url !== "/api/editor/agent") {
            next();
            return;
          }
          try {
            await handleEditorAgentApi(req, res);
          } catch (e) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: String(e) }));
          }
        });
      },
    },
  ],
  server: {
    port: 5173,
  },
});
