import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { ensureDevServer } from "./dev-server.js";

export const renderComposition = async (opts: {
  comp: string;
  out: string;
  concurrency?: number;
}): Promise<string> => {
  await ensureDevServer();

  const args = [
    "render/render.ts",
    "--comp",
    opts.comp,
    "--out",
    opts.out,
    "--concurrency",
    String(opts.concurrency ?? 3),
  ];

  return new Promise<string>((res, rej) => {
    const child = spawn("./node_modules/.bin/tsx", args, {
      cwd: resolve("."),
      stdio: "inherit",
    });
    child.on("error", rej);
    child.on("close", (code) =>
      code === 0 ? res(resolve(opts.out)) : rej(new Error(`渲染失败 exit=${code}`)),
    );
  });
};

// CLI: tsx engine/render-job.ts --comp GeneratedVideo --out out/x.mp4 --concurrency 3
const main = async () => {
  const argv = process.argv.slice(2);
  const get = (name: string, fallback: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };
  const comp = get("comp", "GeneratedVideo");
  const out = get("out", "out/agent-video.mp4");
  const concurrency = Number(get("concurrency", "3"));

  try {
    const path = await renderComposition({ comp, out, concurrency });
    console.log(JSON.stringify({ ok: true, path: resolve(path) }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e) }));
    process.exit(1);
  }
};

import { pathToFileURL } from "node:url";
if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
