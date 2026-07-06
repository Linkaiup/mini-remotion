import { synthSpeech, type TTSResult } from "./tts/index.js";

export type { TTSResult };

/** @deprecated 使用 engine/tts synthSpeech */
export const synthTTS = synthSpeech;

// CLI: tsx engine/tts-job.ts --text "旁白" --basename narration
import { pathToFileURL } from "node:url";

const main = async () => {
  const argv = process.argv.slice(2);
  const get = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i >= 0 && argv[i + 1] ? argv[i + 1] : "";
  };
  const text = get("text");
  const basename = get("basename") || "narration";
  if (!text) {
    console.log(JSON.stringify({ ok: false, error: "需要 --text" }));
    process.exit(1);
  }
  try {
    const result = await synthSpeech(text, basename);
    console.log(JSON.stringify({ ok: true, ...result }));
  } catch (e) {
    console.log(JSON.stringify({ ok: false, error: String(e) }));
    process.exit(1);
  }
};

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main();
}
