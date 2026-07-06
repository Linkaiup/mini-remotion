import { spawn } from "node:child_process";
import { resolve } from "node:path";
import type { AudioMixTrack } from "./prepare-tracks.js";

const runFfmpeg = (args: string[]): Promise<void> =>
  new Promise((res, rej) => {
    const ff = spawn("ffmpeg", args, { stdio: "inherit" });
    ff.on("error", rej);
    ff.on("close", (code) =>
      code === 0 ? res() : rej(new Error(`ffmpeg exited with ${code}`)),
    );
  });

/**
 * 多轨混流(P4-c/d): 无声视频 + 预处理 WAV → 带声 mp4。
 * 音量曲线已在 preprocess-track 烘焙,此处仅 adelay + amix。
 */
export const mergeAudioTracks = async (opts: {
  silentVideo: string;
  tracks: AudioMixTrack[];
  fps: number;
  out: string;
}): Promise<void> => {
  const { silentVideo, tracks, fps, out } = opts;
  if (tracks.length === 0) return;

  const inputs: string[] = ["-i", silentVideo];
  const chains: string[] = [];
  const labels: string[] = [];

  tracks.forEach((t, k) => {
    const inputIndex = k + 1;
    inputs.push("-i", t.filePath);
    const delayMs = Math.round((t.startInFrames / fps) * 1000);
    const label = `a${k}`;
    chains.push(`[${inputIndex}:a]adelay=${delayMs}|${delayMs}[${label}]`);
    labels.push(`[${label}]`);
  });

  const filterComplex =
    tracks.length === 1
      ? `${chains[0]};[a0]anull[aout]`
      : `${chains.join(";")};${labels.join("")}amix=inputs=${tracks.length}:normalize=0[aout]`;

  await runFfmpeg([
    "-y",
    ...inputs,
    "-filter_complex",
    filterComplex,
    "-map",
    "0:v",
    "-map",
    "[aout]",
    "-c:v",
    "copy",
    "-c:a",
    "aac",
    "-shortest",
    resolve(out),
  ]);
};
