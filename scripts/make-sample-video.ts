/**
 * 用 FFmpeg 合成一段 3 秒示例视频(彩色测试图案),写入 public/sample.mp4。
 * 纯合成、零外部素材依赖。运行: npm run make-video
 */
import { spawn } from "node:child_process";
import { resolve } from "node:path";

const out = resolve("public/sample.mp4");

// testsrc2:动态色块图案,适合验证 <Video> seek 与截图
const args = [
  "-y",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=1280x720:rate=30:duration=3",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
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
    console.log(`[mini-remotion] ✅ 已生成示例视频: ${out}`);
  } else {
    process.exit(code ?? 1);
  }
});
