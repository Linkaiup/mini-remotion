import { spawn } from "node:child_process";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { TTSBackend, TTSResult } from "./types.js";

const run = (cmd: string, args: string[]): Promise<void> =>
  new Promise((res, rej) => {
    const child = spawn(cmd, args, { stdio: "pipe" });
    child.on("error", rej);
    child.on("close", (code) =>
      code === 0 ? res() : rej(new Error(`${cmd} exited with ${code}`)),
    );
  });

const probeDuration = (mp3: string): Promise<number> =>
  new Promise((res, rej) => {
    const ff = spawn(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration",
        "-of",
        "default=noprint_wrappers=1:nokey=1",
        mp3,
      ],
      { stdio: ["ignore", "pipe", "pipe"] },
    );
    let out = "";
    ff.stdout.on("data", (d: Buffer) => {
      out += d.toString();
    });
    ff.on("close", (code) => {
      if (code !== 0) return rej(new Error("ffprobe failed"));
      const sec = parseFloat(out.trim());
      res(Number.isFinite(sec) ? sec : 0);
    });
    ff.on("error", rej);
  });

export const createMacOSTTSBackend = (): TTSBackend => ({
  name: "macos-say",
  synth: async (text, outBasename): Promise<TTSResult> => {
    if (process.platform !== "darwin") {
      throw new Error("macOS say 仅支持 darwin");
    }
    const publicDir = resolve("public");
    await mkdir(publicDir, { recursive: true });
    const aiff = resolve(publicDir, `${outBasename}.aiff`);
    const mp3 = resolve(publicDir, `${outBasename}.mp3`);

    await run("say", ["-o", aiff, text]);
    await run("ffmpeg", ["-y", "-i", aiff, "-b:a", "128k", mp3]);

    const durationSeconds = await probeDuration(mp3);
    return { mp3Path: `${outBasename}.mp3`, durationSeconds, backend: "macos-say" };
  },
});
