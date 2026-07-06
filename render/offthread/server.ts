/**
 * Offthread 代理服务 — FFmpeg 版最小实现 (P4-a)。
 *
 * 对照 Remotion packages/renderer/src/offthread-video-server.ts:
 *   GET /proxy?src=&time=&transparent=&toneMapped=
 *   → FFmpeg 抽帧 → 返回 image/png
 *
 * 与 Remotion 的差异:
 *   - 无 Rust compositor;用 FFmpeg 子进程抽帧
 *   - 独立端口(默认 3199),通过 ?proxyPort= 注入浏览器
 *   - transparent / toneMapped 参数保留兼容,当前仅记录不处理
 */
import http from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { extractFramePng } from "./extract-frame.js";
import { resolveVideoSrc } from "./resolve-src.js";

export type OffthreadServer = {
  port: number;
  close: () => Promise<void>;
};

const DEFAULT_PORT = Number(process.env.MINI_REMOTION_PROXY_PORT ?? "3199");

export const parseProxyQuery = (url: string) => {
  const parsed = new URL(url, "http://localhost");
  const params = parsed.searchParams;
  const src = params.get("src");
  const time = params.get("time");
  if (!src) throw new Error("缺少 src 参数");
  if (!time) throw new Error("缺少 time 参数");
  return {
    src,
    time: Math.max(0, parseFloat(time)),
    transparent: params.get("transparent") === "true",
    toneMapped: params.get("toneMapped") !== "false",
  };
};

const handleProxy = async (req: IncomingMessage, res: ServerResponse) => {
  if (!req.url?.startsWith("/proxy")) {
    res.writeHead(404);
    res.end();
    return;
  }

  if (req.method === "OPTIONS") {
    res.writeHead(200, {
      "access-control-allow-origin": "*",
      "access-control-allow-private-network": "true",
    });
    res.end();
    return;
  }

  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "no-cache, no-store, must-revalidate");

  let closed = false;
  req.on("close", () => {
    closed = true;
  });

  try {
    const { src, time } = parseProxyQuery(req.url);
    if (closed) return;

    const filePath = resolveVideoSrc(src);
    const png = await extractFramePng(filePath, time);
    if (closed) return;

    res.writeHead(200, {
      "content-type": "image/png",
      "content-length": String(png.byteLength),
    });
    res.end(png);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (!res.headersSent) {
      res.writeHead(500, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: msg }));
    } else {
      res.end();
    }
  }
};

/** 启动 Offthread HTTP 服务(若端口已占用则复用) */
export const startOffthreadServer = async (
  preferredPort = DEFAULT_PORT,
): Promise<OffthreadServer> => {
  const server = http.createServer((req, res) => {
    void handleProxy(req, res);
  });

  await new Promise<void>((resolve, reject) => {
    server.once("error", reject);
    server.listen(preferredPort, "127.0.0.1", () => resolve());
  });

  const addr = server.address();
  const port = typeof addr === "object" && addr ? addr.port : preferredPort;

  return {
    port,
    close: () =>
      new Promise((res, rej) => {
        server.close((err) => (err ? rej(err) : res()));
      }),
  };
};
