import React, { useEffect, useId, useMemo, useRef } from "react";
import { useCurrentFrame, useSequenceOffset } from "./frame-context";
import { usePlayback } from "./playback";
import { useRenderAssetManager } from "./render-asset-manager";
import { sampleVolumeProp } from "./sample-volume-prop";
import { useVideoConfig } from "./video-config";
import type { VolumeProp } from "./volume-prop";
import { evaluateVolume } from "./volume-prop";

/**
 * <Audio>:声音不靠截图。
 *  - 预览:隐藏 <audio> 跟随帧/播放态,支持 volume(frame) 曲线(P4-d)
 *  - 导出:登记 type:'audio' 资产 → preprocess + FFmpeg 混流
 */
export const Audio: React.FC<{
  src: string;
  volume?: VolumeProp;
  startFrom?: number;
  durationInFrames?: number;
}> = ({ src, volume = 1, startFrom = 0, durationInFrames }) => {
  const config = useVideoConfig();
  const { playing } = usePlayback();
  const offset = useSequenceOffset();
  const assets = useRenderAssetManager();
  const id = useId();
  const frame = useCurrentFrame();

  const dur = durationInFrames ?? config.durationInFrames - offset;
  // 导出会话 mount 时采样整条音量曲线(P4-d)
  const assetVolume = useMemo(
    () => sampleVolumeProp(volume, dur),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- volume 函数在 headless 会话中视为稳定
    [dur, src, startFrom],
  );

  useEffect(() => {
    if (config.mode !== "render" || !assets) return;
    if (window.__miniRemotionAudioEnabled === false) return;

    assets.register({
      type: "audio",
      id,
      src,
      startInFrames: offset,
      durationInFrames: dur,
      startFromInFrames: startFrom,
      volume: assetVolume,
      playbackRate: 1,
    });
    return () => assets.unregister(id);
  }, [assets, config.mode, id, src, offset, dur, startFrom, assetVolume]);

  const ref = useRef<HTMLAudioElement>(null);
  const previewVolume = evaluateVolume({ frame, volume });

  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (el) el.volume = Math.min(1, previewVolume);
  }, [previewVolume, config.mode]);

  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (!el) return;
    const target = startFrom / config.fps + frame / config.fps;
    if (Math.abs(el.currentTime - target) > 0.15) {
      el.currentTime = target;
    }
  }, [frame, startFrom, config.fps, config.mode]);

  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (!el) return;
    if (playing) {
      el.play().catch(() => undefined);
    } else {
      el.pause();
    }
  }, [playing, config.mode]);

  if (config.mode !== "preview") {
    return null;
  }
  return <audio ref={ref} src={src} style={{ display: "none" }} />;
};
