/**
 * 音量属性 — 对照 Remotion VolumeProp(P4-d)。
 * 可为常量,或按「媒体本地帧号」返回音量的函数。
 */
export type VolumeProp = number | ((frame: number) => number);

/** 导出/混流用的音量:常量或逐帧采样数组 */
export type AssetVolume = number | number[];

export const evaluateVolume = ({
  frame,
  volume,
  mediaVolume = 1,
}: {
  frame: number;
  volume: VolumeProp | undefined;
  mediaVolume?: number;
}): number => {
  if (typeof volume === "number") {
    return volume * mediaVolume;
  }

  if (volume === undefined) {
    return mediaVolume;
  }

  const evaluated = volume(frame) * mediaVolume;
  if (typeof evaluated !== "number") {
    throw new TypeError(
      `volume 函数在第 ${frame} 帧返回了 ${typeof evaluated}, 期望 number`,
    );
  }

  if (Number.isNaN(evaluated)) {
    throw new TypeError(`volume 函数在第 ${frame} 帧返回 NaN`);
  }

  if (!Number.isFinite(evaluated)) {
    throw new TypeError(`volume 函数在第 ${frame} 帧返回非有限值`);
  }

  return Math.max(0, evaluated);
};

/** 常量音量数组压平为单个 number(便于 FFmpeg once 求值) */
export const flattenVolume = (volume: AssetVolume): AssetVolume => {
  if (typeof volume === "number") return volume;
  if (volume.length === 0) {
    throw new TypeError("音量数组至少需要一个采样点");
  }
  if (new Set(volume).size === 1) return volume[0];
  return volume;
};
