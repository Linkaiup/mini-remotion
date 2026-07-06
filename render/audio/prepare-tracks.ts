import type { RenderAsset } from "../../src/core/render-asset.js";
import { isSilentVolume } from "../../src/core/sample-volume-prop.js";
import { extractAudioFromVideo } from "./extract-from-video.js";
import { preprocessTrack } from "./preprocess-track.js";
import { resolvePublicAsset } from "./resolve-asset.js";

/**
 * 送入 FFmpeg 混流的一条音轨(已预处理为 WAV)。
 */
export type AudioMixTrack = {
  id: string;
  /** 预处理后的本地 WAV(已 atrim + volume) */
  filePath: string;
  startInFrames: number;
  durationInFrames: number;
  /** 预处理输出从 0 秒开始,恒为 0 */
  startFromInSeconds: number;
  /** 音量已烘焙进 WAV,混流时用 1 */
  volume: number;
  sourceType: "audio" | "video";
};

/**
 * 将 RenderAsset 清单转为可混流音轨(P4-c + P4-d)。
 * - type=audio → public 文件
 * - type=video → 抽轨
 * - preprocessTrack → 截取 + 音量曲线
 */
export const prepareAudioTracks = async (
  assets: RenderAsset[],
  fps: number,
): Promise<AudioMixTrack[]> => {
  const byId = new Map<string, RenderAsset>();
  for (const a of assets) {
    if (isSilentVolume(a.volume)) continue;
    byId.set(a.id, a);
  }

  const tracks: AudioMixTrack[] = [];

  for (const asset of byId.values()) {
    const startFromInSeconds = asset.startFromInFrames / fps;

    try {
      const rawPath =
        asset.type === "audio"
          ? resolvePublicAsset(asset.src)
          : await extractAudioFromVideo(resolvePublicAsset(asset.src));

      const filePath = await preprocessTrack({
        inputPath: rawPath,
        fps,
        startFromInSeconds,
        durationInFrames: asset.durationInFrames,
        volume: asset.volume,
      });

      tracks.push({
        id: asset.id,
        filePath,
        startInFrames: asset.startInFrames,
        durationInFrames: asset.durationInFrames,
        startFromInSeconds: 0,
        volume: 1,
        sourceType: asset.type,
      });
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(
        `[audio] 跳过音轨 ${asset.src}:`,
        e instanceof Error ? e.message : e,
      );
    }
  }

  return tracks;
};
