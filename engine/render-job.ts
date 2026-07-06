import { resolve } from "node:path";
import { ensureRenderSite } from "./render-site.js";
import {
  captureFrames,
  captureFramesWithPool,
  encodeVideo,
  probeMeta,
  scheduleFrames,
} from "../render/pipeline.js";

export { ensureDevServer } from "./dev-server.js";
export { ensureRenderSite, getRenderSiteMode, getRenderSiteUrl } from "./render-site.js";
export { ensureBundle, buildBundle } from "./bundle.js";
export { ensureOffthreadServer, closeOffthreadServer } from "../render/offthread/index.js";
export {
  captureFrames,
  captureFramesWithPool,
  encodeVideo,
  probeMeta,
  scheduleFrames,
};

export const renderComposition = async (opts: {
  comp: string;
  out: string;
  concurrency?: number;
  url?: string;
}): Promise<string> => {
  const url = opts.url ?? (await ensureRenderSite());
  const captured = await captureFrames({
    comp: opts.comp,
    url,
    concurrency: opts.concurrency,
  });
  return encodeVideo({
    meta: captured.meta,
    framesDir: captured.framesDir,
    renderAssets: captured.renderAssets,
    out: opts.out,
  });
};

/** Harness: Chromium Pool 截图 */
export { captureFramesWithPool as captureCompositionFrames };

/** Harness: FFmpeg 编码 */
export { encodeVideo as encodeCompositionVideo };

// CLI
import { pathToFileURL } from "node:url";
import { defaultConcurrency } from "../render/pipeline.js";

const main = async () => {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  try {
    const path = await renderComposition({
      comp: get("comp", "GeneratedVideo"),
      out: get("out", "out/agent-video.mp4"),
      concurrency: Number(get("concurrency", String(defaultConcurrency()))),
    });
    console.log(JSON.stringify({ ok: true, path: resolve(path) }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e) }));
    process.exit(1);
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
