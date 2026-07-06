/**
 * CLI 渲染入口 — 内部调用 render/pipeline.ts 两阶段管线。
 */
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import { ensureRenderSite } from "../engine/render-site.js";
import { captureFrames, defaultConcurrency, encodeVideo } from "./pipeline.js";

const parseArgs = () => {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const rawProps = get("props", "");
  let propsB64 = "";
  if (rawProps) {
    propsB64 = rawProps.trim().startsWith("{")
      ? Buffer.from(rawProps, "utf-8").toString("base64")
      : rawProps;
  }
  return {
    comp: get("comp", "CodeDemo"),
    out: get("out", "out/video.mp4"),
    url: get("url", "http://localhost:5173"),
    concurrency: Math.max(1, Number(get("concurrency", String(defaultConcurrency())))),
    propsB64,
  };
};

const main = async () => {
  const { comp, out, concurrency, propsB64 } = parseArgs();
  const url = await ensureRenderSite();
  await mkdir(resolve("out"), { recursive: true });

  const captured = await captureFrames({ comp, url, concurrency, propsB64 });
  console.log(`[mini-remotion] 截图完成,用时 ${captured.elapsedSeconds.toFixed(1)}s`);

  const finalOut = await encodeVideo({
    meta: captured.meta,
    framesDir: captured.framesDir,
    audios: captured.audios,
    out,
  });
  console.log(`[mini-remotion] ✅ 导出完成: ${finalOut}`);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
