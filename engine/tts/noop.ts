import type { TTSBackend, TTSResult } from "./types.js";

export const createNoopTTSBackend = (): TTSBackend => ({
  name: "noop",
  synth: async (): Promise<TTSResult> => {
    throw new Error("TTS 已禁用 (noop)");
  },
});
