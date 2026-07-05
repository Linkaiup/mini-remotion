import { resolve } from "node:path";
import { ensureDevServer } from "./dev-server.js";
import { captureFrames, encodeVideo } from "../render/pipeline.js";

export { ensureDevServer };

export const renderComposition = async (opts: {
  comp: string;
  out: string;
  concurrency?: number;
  url?: string;
}): Promise<string> => {
  await ensureDevServer();
  const captured = await captureFrames({
    comp: opts.comp,
    url: opts.url,
    concurrency: opts.concurrency,
  });
  return encodeVideo({
    meta: captured.meta,
    framesDir: captured.framesDir,
    audios: captured.audios,
    out: opts.out,
  });
};

/** Harness 专用:仅逐帧截图 */
export const captureCompositionFrames = captureFrames;

/** Harness 专用:仅 FFmpeg 编码 */
export const encodeCompositionVideo = encodeVideo;

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
