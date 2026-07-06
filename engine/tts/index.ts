import { createMacOSTTSBackend } from "./macos.js";
import { createNoopTTSBackend } from "./noop.js";
import type { TTSBackend, TTSResult } from "./types.js";

export type { TTSBackend, TTSResult } from "./types.js";

export const selectTTSBackend = (): TTSBackend => {
  const explicit = process.env.MINI_REMOTION_TTS;
  if (explicit === "noop") return createNoopTTSBackend();
  if (process.platform === "darwin") return createMacOSTTSBackend();
  if (explicit === "macos") return createMacOSTTSBackend();
  return createNoopTTSBackend();
};

export const synthSpeech = async (
  text: string,
  outBasename: string,
): Promise<TTSResult> => {
  const backend = selectTTSBackend();
  return backend.synth(text, outBasename);
};
