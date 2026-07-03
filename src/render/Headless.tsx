import React, { useEffect, useState } from "react";
import { FrameProvider, getPendingCount } from "../core";
import { getComposition } from "../compositions";

/**
 * headless 桥接:导出时 Puppeteer 打开 ?headless=1&comp=<id>,
 * 本组件在 window 上挂载与真实 Remotion 同款的控制函数,
 * 供 Node 端渲染器逐帧驱动 + 截图。
 * 对照真实 Remotion: window.remotion_setFrame(见 packages/core/src/TimelineContext.tsx)
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
  }
}

export const Headless: React.FC<{ compId: string }> = ({ compId }) => {
  const composition = getComposition(compId);
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    if (!composition) return;
    window.__miniRemotionMeta = {
      width: composition.width,
      height: composition.height,
      fps: composition.fps,
      durationInFrames: composition.durationInFrames,
    };
    window.__miniRemotionSetFrame = (f: number) => setFrame(f);
    window.__miniRemotionReady = getPendingCount() === 0;
  }, [composition]);

  if (!composition) {
    return <div>Unknown composition: {compId}</div>;
  }

  const Component = composition.component;

  // 原始分辨率、无缩放、定位到左上角,方便 Puppeteer 按视口精确截图
  return (
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
        <Component />
      </FrameProvider>
    </div>
  );
};
