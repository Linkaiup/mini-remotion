import React, { useEffect, useId, useMemo, useRef } from "react";
import { continueRender, delayRender } from "./delay-render";
import { useCurrentFrame, useSequenceOffset } from "./frame-context";
import { usePlayback } from "./playback";
import { usePreviewTransportRegister } from "./preview-transport";
import { useRenderAssetManager } from "./render-asset-manager";
import { sampleVolumeProp, isSilentVolume } from "./sample-volume-prop";
import { useVideoConfig } from "./video-config";
import type { VolumeProp } from "./volume-prop";
import { evaluateVolume } from "./volume-prop";

/**
 * <Video>:Html5 路线 — 导出时浏览器内 seek + 截图。
 * 预览：音轨作主时钟（PreviewTransport），<video> 静音并按帧 seek 跟画。
 */
export const Video: React.FC<{
  src: string;
  volume?: VolumeProp;
  startFrom?: number;
  durationInFrames?: number;
  muted?: boolean;
  style?: React.CSSProperties;
}> = ({
  src,
  volume = 1,
  startFrom = 0,
  durationInFrames,
  muted,
  style,
}) => {
  const config = useVideoConfig();
  const { playing } = usePlayback();
  const offset = useSequenceOffset();
  const assets = useRenderAssetManager();
  const registerTransport = usePreviewTransportRegister();
  const id = useId();
  const frame = useCurrentFrame();
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const dur = durationInFrames ?? config.durationInFrames - offset;
  const assetVolume = useMemo(
    () => sampleVolumeProp(volume, dur),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dur, src, startFrom],
  );
  const previewVolume = evaluateVolume({ frame, volume });
  const isMuted = muted ?? config.mode === "render";
  const previewSplitAudio = config.mode === "preview" && !isMuted;

  const localFrame = Math.max(0, Math.min(frame, dur - 1));
  const targetSec = (startFrom + localFrame) / config.fps;

  const seekToGlobalFrame = useMemo(
    () => (globalFrame: number) => {
      const el = audioRef.current;
      if (!el) return;
      const local = globalFrame - offset;
      if (local < 0 || local >= dur) {
        el.pause();
        return;
      }
      el.currentTime = startFrom / config.fps + local / config.fps;
    },
    [offset, dur, startFrom, config.fps],
  );

  useEffect(() => {
    if (!previewSplitAudio || !registerTransport) return;
    return registerTransport({
      id: `${id}-preview-audio`,
      priority: 0,
      getGlobalFrame: () => {
        const el = audioRef.current;
        if (!el || el.readyState < 1) return null;
        return (
          offset +
          Math.round((el.currentTime - startFrom / config.fps) * config.fps)
        );
      },
      play: () => {
        audioRef.current?.play().catch(() => undefined);
      },
      pause: () => {
        audioRef.current?.pause();
      },
      seekToGlobalFrame,
    });
  }, [
    previewSplitAudio,
    registerTransport,
    id,
    offset,
    startFrom,
    config.fps,
    seekToGlobalFrame,
  ]);

  useEffect(() => {
    if (config.mode !== "render" || !assets) return;
    if (window.__miniRemotionAudioEnabled === false) return;
    if (isMuted || isSilentVolume(assetVolume)) return;

    assets.register({
      type: "video",
      id: `${id}-audio`,
      src,
      startInFrames: offset,
      durationInFrames: dur,
      startFromInFrames: startFrom,
      volume: assetVolume,
      playbackRate: 1,
    });
    return () => assets.unregister(`${id}-audio`);
  }, [
    assets,
    config.mode,
    id,
    src,
    offset,
    dur,
    startFrom,
    assetVolume,
    isMuted,
  ]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handle = delayRender();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      continueRender(handle);
    };

    const onReady = () => finish();
    el.addEventListener("loadeddata", onReady, { once: true });
    el.addEventListener("error", onReady, { once: true });
    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) finish();

    const timer = window.setTimeout(() => finish(), 15000);
    return () => {
      window.clearTimeout(timer);
      finish();
    };
  }, [src]);

  useEffect(() => {
    if (!previewSplitAudio) return;
    const el = audioRef.current;
    if (el) el.volume = Math.min(1, previewVolume);
  }, [previewVolume, previewSplitAudio]);

  useEffect(() => {
    if (!previewSplitAudio || playing) return;
    seekToGlobalFrame(offset + frame);
  }, [previewSplitAudio, playing, frame, offset, seekToGlobalFrame]);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;

    const handle = config.mode === "render" ? delayRender() : null;
    let done = false;
    const finish = () => {
      if (!handle || done) return;
      done = true;
      continueRender(handle);
    };

    const onSeeked = () => finish();
    if (handle) el.addEventListener("seeked", onSeeked, { once: true });

    if (config.mode === "preview") {
      el.pause();
    }

    if (Math.abs(el.currentTime - targetSec) > 0.04) {
      el.currentTime = targetSec;
    } else if (handle) {
      finish();
    }

    return () => {
      el.removeEventListener("seeked", onSeeked);
      finish();
    };
  }, [frame, targetSec, config.mode]);

  return (
    <>
      <video
        ref={videoRef}
        src={src}
        muted={config.mode === "preview" || isMuted}
        playsInline
        preload="auto"
        style={{ position: "absolute", objectFit: "cover", ...style }}
      />
      {previewSplitAudio ? (
        <audio ref={audioRef} src={src} preload="auto" style={{ display: "none" }} />
      ) : null}
    </>
  );
};
