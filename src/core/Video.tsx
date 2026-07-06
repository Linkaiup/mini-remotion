import React, { useEffect, useId, useMemo, useRef } from "react";
import { continueRender, delayRender } from "./delay-render";
import { useCurrentFrame, useSequenceOffset } from "./frame-context";
import { usePlayback } from "./playback";
import { useRenderAssetManager } from "./render-asset-manager";
import { sampleVolumeProp, isSilentVolume } from "./sample-volume-prop";
import { useVideoConfig } from "./video-config";
import type { VolumeProp } from "./volume-prop";
import { evaluateVolume } from "./volume-prop";

/**
 * <Video>:Html5 路线 — 导出时浏览器内 seek + 截图。
 * 若需抽帧代理请用 <OffthreadVideo>。
 * 未 muted 时导出会登记 type:'video' 音轨(P4-c)。
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
  const id = useId();
  const frame = useCurrentFrame();
  const ref = useRef<HTMLVideoElement>(null);

  const dur = durationInFrames ?? config.durationInFrames - offset;
  const assetVolume = useMemo(
    () => sampleVolumeProp(volume, dur),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dur, src, startFrom],
  );
  const previewVolume = evaluateVolume({ frame, volume });
  const isMuted = muted ?? config.mode === "render";

  // 视频内音轨:导出且未静音时登记(P4-c)
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
    const el = ref.current;
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
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (el) el.volume = Math.min(1, previewVolume);
  }, [previewVolume, config.mode]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const localFrame = Math.max(0, Math.min(frame, dur - 1));
    const targetSec = (startFrom + localFrame) / config.fps;

    const handle = config.mode === "render" ? delayRender() : null;
    let done = false;
    const finish = () => {
      if (!handle || done) return;
      done = true;
      continueRender(handle);
    };

    const onSeeked = () => finish();
    if (handle) el.addEventListener("seeked", onSeeked, { once: true });

    if (Math.abs(el.currentTime - targetSec) > 0.04) {
      el.currentTime = targetSec;
    } else if (handle) {
      finish();
    }

    return () => {
      el.removeEventListener("seeked", onSeeked);
      finish();
    };
  }, [frame, startFrom, dur, config.fps, config.mode]);

  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (!el) return;
    if (playing) el.play().catch(() => undefined);
    else el.pause();
  }, [playing, config.mode]);

  return (
    <video
      ref={ref}
      src={src}
      muted={isMuted}
      playsInline
      preload="auto"
      style={{ position: "absolute", objectFit: "cover", ...style }}
    />
  );
};
