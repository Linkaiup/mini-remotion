/**
 * 用 FFmpeg 合成一段示例音频(5 秒,与示例视频等长),写入 public/audio.mp3。
 * 纯合成、零外部素材依赖。运行: npm run make-audio
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const out = resolve("public/audio.mp3");

// 440Hz 正弦 + 颤音(tremolo)+ 淡入淡出 + 降低音量,避免刺耳
const filter =
  "tremolo=f=5:d=0.6,afade=t=in:st=0:d=0.3,afade=t=out:st=4.5:d=0.5,volume=0.25";

const args = [
  "-y",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=5:sample_rate=44100",
  "-af",
  filter,
  "-b:a",
  "128k",
  out,
];

const ff = spawn("ffmpeg", args, { stdio: "inherit" });
ff.on("error", (e) => {
  console.error("需要系统安装 ffmpeg。", e);
  process.exit(1);
});
ff.on("close", (code) => {
  if (code === 0) {
    console.log(`[mini-remotion] ✅ 已生成示例音频: ${out}`);
  } else {
    process.exit(code ?? 1);
  }
});
