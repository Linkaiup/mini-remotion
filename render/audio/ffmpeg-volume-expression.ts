/**
 * 将 AssetVolume 转为 FFmpeg volume 滤镜表达式(P4-d)。
 * 精简自 Remotion packages/renderer/src/assets/ffmpeg-volume-expression.ts
 */
import type { AssetVolume } from "../../src/core/volume-prop.js";

type FfmpegEval = "once" | "frame";

type VolumeArray = [number, number[]][];

const FFMPEG_TIME_VARIABLE = "t";

const ffmpegIfOrElse = (condition: string, then: string, elseDo: string) =>
  `if(${condition},${then},${elseDo})`;

const ffmpegIsOneOfFrames = ({
  frames,
  trimLeft,
  fps,
}: {
  frames: number[];
  trimLeft: number;
  fps: number;
}) => {
  const consecutiveArrays: number[][] = [];
  for (let i = 0; i < frames.length; i++) {
    const previousFrame = frames[i - 1];
    const frame = frames[i];
    if (previousFrame === undefined || frame !== previousFrame + 1) {
      consecutiveArrays.push([]);
    }
    consecutiveArrays[consecutiveArrays.length - 1].push(frame);
  }

  return consecutiveArrays
    .map((f) => {
      const firstFrame = f[0];
      const lastFrame = f[f.length - 1];
      const before = (firstFrame - 0.5) / fps;
      const after = (lastFrame + 0.5) / fps;
      return `between(${FFMPEG_TIME_VARIABLE},${(before + trimLeft).toFixed(4)},${(after + trimLeft).toFixed(4)})`;
    })
    .join("+");
};

const ffmpegBuildVolumeExpression = ({
  arr,
  delay,
  fps,
}: {
  arr: VolumeArray;
  delay: number;
  fps: number;
}): string => {
  if (arr.length === 0) {
    throw new Error("音量表达式数组不能为空");
  }

  if (arr.length === 1) {
    return String(arr[0][0]);
  }

  const [first, ...rest] = arr;
  const [vol, frames] = first;

  return ffmpegIfOrElse(
    ffmpegIsOneOfFrames({ frames, trimLeft: delay, fps }),
    String(vol),
    ffmpegBuildVolumeExpression({ arr: rest, delay, fps }),
  );
};

export type FfmpegVolumeExpression = {
  eval: FfmpegEval;
  value: string;
};

export const ffmpegVolumeExpression = ({
  volume,
  fps,
  trimLeft,
}: {
  volume: AssetVolume;
  trimLeft: number;
  fps: number;
}): FfmpegVolumeExpression => {
  if (typeof volume === "number") {
    return { eval: "once", value: String(volume) };
  }

  if ([...new Set(volume)].length === 1) {
    return ffmpegVolumeExpression({
      volume: volume[0],
      fps,
      trimLeft,
    });
  }

  // 末帧 padding: 避免最后一帧时长不足 1/fps
  const paddedVolume = [...volume, volume[volume.length - 1]];

  const volumeMap: Record<string, number[]> = {};
  paddedVolume.forEach((baseVolume, frame) => {
    const key = String(baseVolume);
    if (!volumeMap[key]) volumeMap[key] = [];
    volumeMap[key].push(frame);
  });

  const volumeArray: VolumeArray = Object.keys(volumeMap)
    .map((key): [number, number[]] => [Number(key), volumeMap[key]])
    .sort((a, b) => a[1].length - b[1].length);

  const expression = ffmpegBuildVolumeExpression({
    arr: volumeArray,
    delay: trimLeft,
    fps,
  });

  return { eval: "frame", value: `'${expression}'` };
};
