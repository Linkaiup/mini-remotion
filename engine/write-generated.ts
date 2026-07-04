import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

export const GENERATED_PATH = resolve("src/generated/current.tsx");

export const writeGenerated = async (code: string): Promise<string> => {
  const banner =
    "// 本文件由 video-agent 生成,请勿手改(下次运行会被覆盖)。\n";
  const full = banner + code.trim() + "\n";
  await writeFile(GENERATED_PATH, full, "utf-8");
  return GENERATED_PATH;
};

// CLI: tsx engine/write-generated.ts --code-file <path>
const main = async () => {
  const argv = process.argv.slice(2);
  const fileIdx = argv.indexOf("--code-file");
  if (fileIdx < 0 || !argv[fileIdx + 1]) {
    console.error(JSON.stringify({ ok: false, error: "用法: --code-file <path>" }));
    process.exit(1);
  }
  const { readFile } = await import("node:fs/promises");
  const code = await readFile(argv[fileIdx + 1], "utf-8");
  const path = await writeGenerated(code);
  console.log(JSON.stringify({ ok: true, path }));
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.error(JSON.stringify({ ok: false, error: String(e) }));
    process.exit(1);
  });
}
