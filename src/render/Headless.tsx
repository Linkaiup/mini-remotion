import React, { useEffect, useRef, useState } from "react";
import {
  FrameProvider,
  PlaybackProvider,
  RenderAssetManagerProvider,
  VideoConfigProvider,
  getPendingCount,
} from "../core";
import { getComposition } from "../compositions";

/**
 * headless 桥接:导出时 Puppeteer 打开 ?headless=1&comp=<id>,
 * 挂载帧驱动 API + 媒体资产收集(__miniRemotionCollectAssets)。
 */
declare global {
  interface Window {
    __miniRemotionSetFrame?: (frame: number) => void;
    __miniRemotionReady?: boolean;
    __miniRemotionMeta?: {
      width: number;
      height: number;
      fps: number;
      durationInFrames: number;
    };
    __miniRemotionCollectAssets?: () => import("../core/render-asset").RenderAsset[];
  }
}

export const Headless: React.FC<{
  compId: string;
  inputProps: Record<string, unknown>;
}> = ({ compId, inputProps }) => {
  const composition = getComposition(compId);
  const [frame, setFrame] = useState(0);
  const readyPollRef = useRef<number | null>(null);

  useEffect(() => {
    if (!composition) return;
    window.__miniRemotionMeta = {
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
    };
    window.__miniRemotionSetFrame = (f: number) => setFrame(f);

    readyPollRef.current = window.setInterval(() => {
      window.__miniRemotionReady = getPendingCount() === 0;
    }, 16);
    return () => {
      if (readyPollRef.current !== null)
        window.clearInterval(readyPollRef.current);
    };
  }, [composition]);

  if (!composition) {
    return <div>Unknown composition: {compId}</div>;
  }

  const Component = composition.component;
  const mergedProps = { ...composition.defaultProps, ...inputProps };

  return (
    <VideoConfigProvider
      config={{
        id: composition.id,
        width: composition.width,
        height: composition.height,
        fps: composition.fps,
        durationInFrames: composition.durationInFrames,
        mode: "render",
      }}
    >
      <PlaybackProvider playing={false}>
        <RenderAssetManagerProvider>
          <div
            id="mini-remotion-canvas"
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              width: composition.width,
              height: composition.height,
              overflow: "hidden",
            }}
          >
            <FrameProvider frame={frame}>
              <Component {...mergedProps} />
            </FrameProvider>
          </div>
        </RenderAssetManagerProvider>
      </PlaybackProvider>
    </VideoConfigProvider>
  );
};
