import React, { useEffect, useId, useLayoutEffect, useMemo, useState } from "react";
import { continueRender, delayRender } from "./delay-render";
import { Img } from "./Img";
import { useCurrentFrame, useSequenceOffset } from "./frame-context";
import { getOffthreadVideoSource } from "./offthread-video-source";
import { useVideoConfig } from "./video-config";
import { useRenderAssetManager } from "./render-asset-manager";
import { sampleVolumeProp, isSilentVolume } from "./sample-volume-prop";
import { Video } from "./Video";
import type { VolumeProp } from "./volume-prop";

/**
 * <OffthreadVideo>:导出时用 Node FFmpeg 代理抽帧,预览时用 <Video>。
 *
 * 导出流程(对照 Remotion OffthreadVideoForRendering):
 *   1. 按当前帧计算 currentTime
 *   2. fetch(http://127.0.0.1:{proxyPort}/proxy?src=&time=)
 *   3. blob → <Img> 显示(视频解码在浏览器外完成)
 *
 * 需渲染器启动 render/offthread 服务并注入 __miniRemotionProxyPort。
 */
export const OffthreadVideo: React.FC<{
  src: string;
  volume?: VolumeProp;
  startFrom?: number;
  durationInFrames?: number;
  muted?: boolean;
  style?: React.CSSProperties;
  transparent?: boolean;
  toneMapped?: boolean;
}> = (props) => {
  const config = useVideoConfig();
  if (config.mode === "preview") {
    return <Video {...props} />;
  }
  return <OffthreadVideoForRendering {...props} />;
};

const OffthreadVideoForRendering: React.FC<{
  src: string;
  volume?: VolumeProp;
  startFrom?: number;
  durationInFrames?: number;
  muted?: boolean;
  style?: React.CSSProperties;
  transparent?: boolean;
  toneMapped?: boolean;
}> = ({
  src,
  volume = 1,
  startFrom = 0,
  durationInFrames,
  muted,
  style,
  transparent = false,
  toneMapped = true,
}) => {
  const config = useVideoConfig();
  const offset = useSequenceOffset();
  const assets = useRenderAssetManager();
  const id = useId();
  const frame = useCurrentFrame();

  const dur = durationInFrames ?? config.durationInFrames - offset;
  const assetVolume = useMemo(
    () => sampleVolumeProp(volume, dur),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [dur, src, startFrom],
  );
  const isMuted = muted ?? false;
  const localFrame = Math.max(0, Math.min(frame, dur - 1));
  const currentTime = (startFrom + localFrame) / config.fps;

  // 视频文件内音轨:导出时登记,由 prepareAudioTracks 抽轨混流(P4-c)
  useEffect(() => {
    if (!assets) return;
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
    id,
    src,
    offset,
    dur,
    startFrom,
    assetVolume,
    isMuted,
  ]);

  const proxyUrl = useMemo(
    () =>
      getOffthreadVideoSource({
        src,
        currentTime,
        transparent,
        toneMapped,
      }),
    [src, currentTime, transparent, toneMapped],
  );

  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useLayoutEffect(() => {
    if (window.__miniRemotionVideoEnabled === false) return;

    setBlobUrl(null);
    const handle = delayRender();
    const controller = new AbortController();
    let objectUrl: string | null = null;

    const run = async () => {
      try {
        const res = await fetch(proxyUrl, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!res.ok) {
          let msg = `Offthread proxy HTTP ${res.status}`;
          try {
            const json = (await res.json()) as { error?: string };
            if (json.error) msg = json.error;
          } catch {
            /* ignore */
          }
          throw new Error(msg);
        }
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(blob);
        setBlobUrl(objectUrl);
        continueRender(handle);
      } catch (e) {
        if (!controller.signal.aborted) {
          // eslint-disable-next-line no-console
          console.error("[mini-remotion] OffthreadVideo", e);
        }
        continueRender(handle);
      }
    };

    void run();

    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      continueRender(handle);
    };
  }, [proxyUrl, src, currentTime]);

  if (window.__miniRemotionVideoEnabled === false || !blobUrl) {
    return null;
  }

  return (
    <Img
      src={blobUrl}
      alt=""
      style={{
        position: "absolute",
        objectFit: "cover",
        ...style,
      }}
    />
  );
};
