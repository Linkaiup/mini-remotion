import React, { useEffect, useId, useMemo, useRef } from "react";
import { useCurrentFrame, useSequenceOffset } from "./frame-context";
import { usePlayback } from "./playback";
import { usePreviewTransportRegister } from "./preview-transport";
import { useRenderAssetManager } from "./render-asset-manager";
import { sampleVolumeProp } from "./sample-volume-prop";
import { useVideoConfig } from "./video-config";
import type { VolumeProp } from "./volume-prop";
import { evaluateVolume } from "./volume-prop";

/**
 * <Audio>:预览时登记为 PreviewTransport 时钟源；暂停/拖拽时 seek 对齐。
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
  const registerTransport = usePreviewTransportRegister();
  const id = useId();
  const frame = useCurrentFrame();

  const dur = durationInFrames ?? config.durationInFrames - offset;
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

  const seekToGlobalFrame = useMemo(
    () => (globalFrame: number) => {
      const el = ref.current;
      if (!el) return;
      const local = globalFrame - offset;
      if (local < 0 || local >= dur) {
        el.pause();
        return;
      }
      const target = startFrom / config.fps + local / config.fps;
      if (Math.abs(el.currentTime - target) > 0.04) {
        el.currentTime = target;
      }
    },
    [offset, dur, startFrom, config.fps],
  );

  useEffect(() => {
    if (config.mode !== "preview" || !registerTransport) return;
    return registerTransport({
      id,
      priority: 1,
      getGlobalFrame: () => {
        const el = ref.current;
        if (!el || el.readyState < 1) return null;
        return (
          offset +
          Math.round((el.currentTime - startFrom / config.fps) * config.fps)
        );
      },
      play: () => {
        ref.current?.play().catch(() => undefined);
      },
      pause: () => {
        ref.current?.pause();
      },
      seekToGlobalFrame,
    });
  }, [config.mode, registerTransport, id, offset, startFrom, config.fps, seekToGlobalFrame]);

  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (el) el.volume = Math.min(1, previewVolume);
  }, [previewVolume, config.mode]);

  useEffect(() => {
    if (config.mode !== "preview" || playing) return;
    seekToGlobalFrame(offset + frame);
  }, [config.mode, playing, frame, offset, seekToGlobalFrame]);

  if (config.mode !== "preview") {
    return null;
  }
  return <audio ref={ref} src={src} preload="auto" style={{ display: "none" }} />;
};
