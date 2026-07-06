import React, { useEffect, useRef, useState } from "react";
import {
  AudioManagerProvider,
  FrameProvider,
  PlaybackProvider,
  VideoConfigProvider,
  VideoManagerProvider,
  getPendingCount,
  useAudioManager,
  useVideoManager,
} from "../core";
import type { AudioEntry, VideoEntry } from "../core";
import { getComposition } from "../compositions";

/**
 * headless 桥接:导出时 Puppeteer 打开 ?headless=1&comp=<id>,
 * 本组件在 window 上挂载与真实 Remotion 同款的控制函数,
 * 供 Node 端渲染器逐帧驱动 + 截图,并暴露音频时间线供离线混流。
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
    __miniRemotionGetAudio?: () => AudioEntry[];
    /** 当前帧 composition 登记的视频轨(调试用,导出主要靠 DOM seek + 截图) */
    __miniRemotionGetVideo?: () => VideoEntry[];
  }
}

// 把 VideoManager 的读取函数挂到 window
const VideoBridge: React.FC = () => {
  const manager = useVideoManager();
  useEffect(() => {
    window.__miniRemotionGetVideo = () => manager?.getEntries() ?? [];
    return () => {
      delete window.__miniRemotionGetVideo;
    };
  }, [manager]);
  return null;
};

// 把 AudioManager 的读取函数挂到 window,供渲染器每帧抓取
const AudioBridge: React.FC = () => {
  const manager = useAudioManager();
  useEffect(() => {
    window.__miniRemotionGetAudio = () => manager?.getEntries() ?? [];
    return () => {
      delete window.__miniRemotionGetAudio;
    };
  }, [manager]);
  return null;
};

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

    // 持续同步 ready 标志(delayRender 计数可能异步变化)
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
        <AudioManagerProvider>
          <VideoManagerProvider>
            <AudioBridge />
            <VideoBridge />
          {/* 原始分辨率、无缩放、定位左上角,方便 Puppeteer 精确截图 */}
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
          </VideoManagerProvider>
        </AudioManagerProvider>
      </PlaybackProvider>
    </VideoConfigProvider>
  );
};
