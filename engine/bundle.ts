/**
 * Bundle 渲染模式 — 用 vite build 产物替代 dev server。
 *
 * 真实 Remotion 的 bundle() 会预打包 composition 站点,CI/云渲染不依赖 HMR。
 * mini-remotion 等价流程:
 *   1. vite build → dist/
 *   2. vite preview 静态托管 → http://localhost:4173
 *   3. Puppeteer 访问 preview URL 截图(与 dev 模式相同 API)
 *
 * 启用: MINI_REMOTION_RENDER_MODE=bundle
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const BUNDLE_URL =
  process.env.MINI_REMOTION_BUNDLE_URL ?? "http://localhost:4173";

const DIST_INDEX = resolve("dist/index.html");
const BUNDLE_PORT = Number(
  process.env.MINI_REMOTION_BUNDLE_PORT ?? "4173",
);

const isServerUp = async (url: string): Promise<boolean> => {
  try {
    const res = await fetch(url, { method: "GET" });
    return res.ok;
  } catch {
    return false;
  }
};

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const runCommand = (cmd: string, args: string[]): Promise<void> =>
  new Promise((res, rej) => {
    const child = spawn(cmd, args, {
      cwd: resolve("."),
      stdio: "inherit",
    });
    child.on("error", rej);
    child.on("close", (code) =>
      code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`)),
    );
  });

/** 若 dist/ 不存在或强制重建,执行 vite build */
export const buildBundle = async (force = false): Promise<void> => {
  if (!force && existsSync(DIST_INDEX)) return;
  console.log("[bundle] 正在 vite build…");
  await runCommand("./node_modules/.bin/vite", ["build"]);
};

let previewChild: ReturnType<typeof spawn> | null = null;

/** 确保 bundle preview 服务就绪(先 build 再 preview) */
export const ensureBundle = async (): Promise<string> => {
  if (await isServerUp(BUNDLE_URL)) return BUNDLE_URL;

  await buildBundle();

  if (!(await isServerUp(BUNDLE_URL))) {
    console.log(`[bundle] 启动 vite preview :${BUNDLE_PORT}…`);
    previewChild = spawn(
      "./node_modules/.bin/vite",
      ["preview", "--port", String(BUNDLE_PORT), "--host"],
      {
        cwd: resolve("."),
        stdio: "ignore",
        detached: true,
      },
    );
    previewChild.unref();
  }

  for (let i = 0; i < 60; i++) {
    await wait(500);
    if (await isServerUp(BUNDLE_URL)) {
      console.log(`[bundle] preview 就绪 → ${BUNDLE_URL}`);
      return BUNDLE_URL;
    }
  }
  throw new Error("bundle preview 启动超时");
};

/** 进程退出时尝试关闭 preview(仅本进程 spawn 的) */
export const stopBundlePreview = (): void => {
  if (previewChild?.pid) {
    try {
      process.kill(-previewChild.pid);
    } catch {
      /* 已退出 */
    }
    previewChild = null;
  }
};
