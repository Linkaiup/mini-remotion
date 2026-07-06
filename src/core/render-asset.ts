/**
 * 导出时登记的媒体资产 — 统一音频与视频音轨。
 * 对照 Remotion TRenderAsset 中的 AudioOrVideoAsset(精简版)。
 */
import type { AssetVolume } from "./volume-prop";

export type RenderAsset = {
  /** audio = 纯音频文件; video = 从视频文件抽取音轨混流 */
  type: "audio" | "video";
  id: string;
  /** staticFile 路径,如 /audio.mp3 */
  src: string;
  /** 在整条 composition 时间线上的起始帧(含 Sequence 偏移) */
  startInFrames: number;
  durationInFrames: number;
  /** 从源媒体第几帧开始取 */
  startFromInFrames: number;
  /** 常量或逐帧音量曲线(P4-d) */
  volume: AssetVolume;
  playbackRate: number;
};

/** 与旧 AudioEntry 兼容的别名(管线混流输入) */
export type AudioEntry = {
  id: string;
  src: string;
  startInFrames: number;
  durationInFrames: number;
  startFromInSeconds: number;
  volume: number;
};

export const renderAssetToAudioEntry = (
  asset: RenderAsset,
  fps: number,
): AudioEntry => ({
  id: asset.id,
  src: asset.src,
  startInFrames: asset.startInFrames,
  durationInFrames: asset.durationInFrames,
  startFromInSeconds: asset.startFromInFrames / fps,
  volume:
    typeof asset.volume === "number"
      ? asset.volume
      : (asset.volume[0] ?? 0),
});
