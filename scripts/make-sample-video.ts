/**
 * 用 FFmpeg 合成一段 3 秒示例视频(彩色测试图案 + 440Hz 正弦音轨),写入 public/sample.mp4。
 * 纯合成、零外部素材依赖。运行: npm run make-video
 *
 * 音轨用于验证 P4-c: OffthreadVideo 导出时从视频抽轨并混流进最终 mp4。
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const out = resolve("public/sample.mp4");

// testsrc2: 动态色块画面; sine: 简单可辨音轨,便于听感验证混流
const args = [
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=1280x720:rate=30:duration=3",
  "-f",
  "lavfi",
  "-i",
  "sine=frequency=440:duration=3:sample_rate=48000",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-c:a",
  "aac",
  "-b:a",
  "128k",
  "-shortest",
  "-movflags",
  "+faststart",
  out,
];

const ff = spawn("ffmpeg", args, { stdio: "inherit" });
ff.on("error", (e) => {
  console.error("需要系统安装 ffmpeg。", e);
  process.exit(1);
});
ff.on("close", (code) => {
  if (code === 0) {
    console.log(`[mini-remotion] ✅ 已生成示例视频(含音轨): ${out}`);
  } else {
    process.exit(code ?? 1);
  }
});
