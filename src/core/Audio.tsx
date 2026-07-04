import React, { useEffect, useId, useRef } from "react";
import { useCurrentFrame, useSequenceOffset } from "./frame-context";
import { useAudioManager } from "./audio-manager";
import { usePlayback } from "./playback";
import { useVideoConfig } from "./video-config";

/**
 * <Audio>:声音不靠截图。
 *  - 预览模式:渲染一个隐藏 <audio>,跟随当前帧 / 播放态同步。
 *  - 导出模式:不播放,只把自己登记进音频时间线,交给 FFmpeg 离线混流。
 * 对照真实 Remotion: packages/core/src/audio/Audio.tsx
 */
export const Audio: React.FC<{
  src: string;
  volume?: number; // 0..1
  startFrom?: number; // 从音频文件的第几帧开始取(裁掉开头)
  durationInFrames?: number; // 播放帧数,默认到 composition 结束
}> = ({ src, volume = 1, startFrom = 0, durationInFrames }) => {
  const config = useVideoConfig();
  const { playing } = usePlayback();
  const offset = useSequenceOffset();
  const manager = useAudioManager();
  const id = useId();
  const frame = useCurrentFrame();

  const dur = durationInFrames ?? config.durationInFrames - offset;
  const clampedVolume = Math.max(0, Math.min(1, volume));

  // 导出登记:写进音频时间线(startInFrames 来自所在 Sequence 的偏移)
  useEffect(() => {
    if (!manager) return;
    manager.register({
      id,
      src,
      startInFrames: offset,
      durationInFrames: dur,
      startFromInSeconds: startFrom / config.fps,
      volume: clampedVolume,
    });
    return () => manager.unregister(id);
  }, [manager, id, src, offset, dur, startFrom, clampedVolume, config.fps]);

  const ref = useRef<HTMLAudioElement>(null);

  // 预览:音量
  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (el) el.volume = clampedVolume;
  }, [clampedVolume, config.mode]);

  // 预览:seek 时把音频播放位置对齐到当前帧
  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (!el) return;
    const target = startFrom / config.fps + frame / config.fps;
    if (Math.abs(el.currentTime - target) > 0.15) {
      el.currentTime = target;
    }
  }, [frame, startFrom, config.fps, config.mode]);

  // 预览:播放/暂停跟随驱动层
  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (!el) return;
    if (playing) {
      el.play().catch(() => {
        /* 浏览器自动播放策略:需用户手势,忽略 */
      });
    } else {
      el.pause();
    }
  }, [playing, config.mode]);

  if (config.mode !== "preview") {
    return null;
  }
  return <audio ref={ref} src={src} style={{ display: "none" }} />;
};
