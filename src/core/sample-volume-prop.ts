import type { AssetVolume, VolumeProp } from "./volume-prop";
import { evaluateVolume, flattenVolume } from "./volume-prop";

/**
 * 将 React 侧的 VolumeProp 采样为可序列化的 AssetVolume(P4-d)。
 * 在组件 mount 时一次性采样整条 clip,供 Node 侧 preprocess。
 */
export const sampleVolumeProp = (
  volume: VolumeProp | undefined,
  durationInFrames: number,
): AssetVolume => {
  if (durationInFrames <= 0) return 0;

  if (volume === undefined) return 1;

  if (typeof volume === "number") {
    return Math.max(0, volume);
  }

  const samples = Array.from({ length: durationInFrames }, (_, frame) =>
    evaluateVolume({ frame, volume }),
  );

  return flattenVolume(samples);
};

/** 判断整条音轨是否可忽略(全静音) */
export const isSilentVolume = (volume: AssetVolume): boolean => {
  if (typeof volume === "number") return volume <= 0;
  return volume.every((v) => v <= 0);
};
