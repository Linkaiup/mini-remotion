/**
 * 渲染站点统一入口 — dev server 或 bundle preview。
 *
 * MINI_REMOTION_RENDER_MODE:
 *   - dev (默认): Vite dev server :5173,支持 HMR,适合本地开发
 *   - bundle: vite build + preview :4173,适合 CI/无头云渲染
 */
import { ensureBundle, BUNDLE_URL } from "./bundle.js";
import { ensureDevServer } from "./dev-server.js";

export const DEV_URL =
  process.env.MINI_REMOTION_DEV_URL ?? "http://localhost:5173";

export type RenderSiteMode = "dev" | "bundle";

export const getRenderSiteMode = (): RenderSiteMode =>
  process.env.MINI_REMOTION_RENDER_MODE === "bundle" ? "bundle" : "dev";

/** 确保渲染站点可访问,返回 base URL(无尾斜杠) */
export const ensureRenderSite = async (): Promise<string> => {
  if (getRenderSiteMode() === "bundle") {
    return ensureBundle();
  }
  await ensureDevServer();
  return DEV_URL;
};

export const getRenderSiteUrl = (): string =>
  getRenderSiteMode() === "bundle" ? BUNDLE_URL : DEV_URL;
