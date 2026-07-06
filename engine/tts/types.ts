export type TTSResult = {
  mp3Path: string;
  durationSeconds: number;
  backend: string;
};

export type TTSBackend = {
  name: string;
  synth: (text: string, outBasename: string) => Promise<TTSResult>;
};
