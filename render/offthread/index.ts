/**
 * Offthread 抽帧服务 — 对外入口。
 * 渲染前 ensureOffthreadServer(), 将 port 通过 ?proxyPort= 传给 Headless。
 */
import { startOffthreadServer, type OffthreadServer } from "./server.js";

export { extractFramePng } from "./extract-frame.js";
export { parseProxyQuery, startOffthreadServer } from "./server.js";
export type { OffthreadServer };

let singleton: OffthreadServer | null = null;

export const ensureOffthreadServer = async (): Promise<OffthreadServer> => {
  if (singleton) return singleton;
  singleton = await startOffthreadServer();
  console.log(`[offthread] 代理就绪 http://127.0.0.1:${singleton.port}/proxy`);
  return singleton;
};

export const getOffthreadProxyPort = (): number | null =>
  singleton?.port ?? null;

export const closeOffthreadServer = async (): Promise<void> => {
  if (!singleton) return;
  await singleton.close();
  singleton = null;
};
