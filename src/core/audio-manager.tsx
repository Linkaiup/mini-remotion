/**
 * @deprecated 请使用 RenderAssetManagerProvider。保留兼容导出。
 */
export {
  RenderAssetManagerProvider as AudioManagerProvider,
  useRenderAssetManager as useAudioManager,
} from "./render-asset-manager";
export type { AudioEntry } from "./render-asset";
export type AudioEntryLegacy = {
  id: string;
  src: string;
  startInFrames: number;
  durationInFrames: number;
  startFromInSeconds: number;
  volume: number;
};
