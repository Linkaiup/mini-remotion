#!/usr/bin/env node
/**
 * Harness CLI — TypeScript 状态机 Agent
 *
 * npm run agent -- "视频描述"
 * npm run agent -- "产品介绍" --narration "旁白文本"
 *
 * 配置: 复制 .env.example → .env, 填入 DEEPSEEK_API_KEY 等
 */
import { loadEnv } from "../config/env.js";
import { runHarness } from "./state-machine.js";

loadEnv();

const parseArgs = () => {
  const argv = process.argv.slice(2);
  const getFlag = (name: string) => argv.includes(`--${name}`);
  const getValue = (name: string, fallback?: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
  };

  const flagWithValue = new Set([
    "out",
    "narration",
    "concurrency",
    "max-retries",
    "min-quality",
  ]);
  const skip = new Set<number>();
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const name = arg.slice(2);
    if (flagWithValue.has(name) && i + 1 < argv.length) skip.add(i + 1);
  }
  const positional = argv.filter(
    (_, i) => !skip.has(i) && !argv[i].startsWith("--"),
  );
  const prompt = positional.join(" ").trim();

  if (!prompt) {
    console.error(`用法: npm run agent -- "视频描述" [选项]

选项:
  --out <path>           输出 mp4 (默认 out/agent-video.mp4)
  --narration <text>     旁白(macOS say)
  --no-tts               跳过 TTS
  --no-render            只生成+校验
  --concurrency <n>      并发段数
  --max-retries <n>      最大重试 (默认 3)
  --min-quality <0-1>    最低质量分 (默认 0.5)

环境变量:
  在项目根目录创建 .env (参考 .env.example), 或 export 到 shell
  DEEPSEEK_API_KEY, DEEPSEEK_MODEL, MINI_REMOTION_PROVIDER=stub|deepseek|openai
`);
    process.exit(1);
  }

  return {
    prompt,
    out: getValue("out", "out/agent-video.mp4"),
    narration: getValue("narration"),
    noTts: getFlag("no-tts"),
    skipRender: getFlag("no-render"),
    concurrency: getValue("concurrency")
      ? Number(getValue("concurrency"))
      : undefined,
    maxRetries: Number(getValue("max-retries", "3")),
    minQualityScore: Number(getValue("min-quality", "0.5")),
  };
};

const main = async () => {
  const args = parseArgs();
  const result = await runHarness({
    prompt: args.prompt,
    narration: args.narration,
    out: args.out,
    maxRetries: args.maxRetries,
    concurrency: args.concurrency,
    skipRender: args.skipRender,
    noTts: args.noTts,
    minQualityScore: args.minQualityScore,
  });

  console.log("\n[harness] 完成 (DONE)");
  console.log(`  provider: ${result.provider}`);
  console.log(`  attempts: ${result.attempts}`);
  console.log(`  code:     ${result.codePath}`);
  if (result.videoPath) console.log(`  video:    ${result.videoPath}`);
  if (result.quality)
    console.log(`  quality:  ${result.quality.score.toFixed(2)}`);
  if (result.tts)
    console.log(
      `  audio:    public/${result.tts.mp3Path} (${result.tts.durationSeconds.toFixed(1)}s)`,
    );
};

main().catch((err) => {
  console.error("[harness:FAILED]", err);
  process.exit(1);
});
