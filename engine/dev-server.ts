/**
 * Node.js 渲染引擎 — 确保 Vite dev server 就绪(供冒烟测试与渲染使用)。
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const DEV_URL = process.env.MINI_REMOTION_DEV_URL ?? "http://localhost:5173";

const isServerUp = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const ensureDevServer = async (): Promise<void> => {
  if (await isServerUp(DEV_URL)) return;

  console.log("[engine] dev server 未运行,正在启动 vite…");
  const child = spawn("./node_modules/.bin/vite", ["--port", "5173"], {
    cwd: resolve("."),
    stdio: "ignore",
    detached: true,
  });
  child.unref();

  for (let i = 0; i < 60; i++) {
    await wait(500);
    if (await isServerUp(DEV_URL)) {
      console.log("[engine] dev server 就绪");
      return;
    }
  }
  throw new Error("dev server 启动超时");
};
