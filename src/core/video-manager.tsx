import React, { createContext, useContext, useMemo, useRef } from "react";

/**
 * 视频时间线的一条记录:描述"哪个视频文件、从第几帧开始、播放多久"。
 *
 * 与 <Audio> 不同,<Video> 在导出时**主要依赖逐帧 seek + 画面截图**合成,
 * 而非 FFmpeg 离线叠轨。登记 VideoEntry 的目的:
 *  1. 调试:Headless 可枚举当前 composition 引用了哪些视频素材
 *  2. 扩展:未来若走 FFmpeg overlay 混流,可直接复用这份清单
 *
 * 对照真实 Remotion: packages/core 内部的 video asset 收集机制。
 */
export type VideoEntry = {
  id: string;
  src: string;
  /** 在整条 composition 时间线上的起始帧(含 Sequence 偏移) */
  startInFrames: number;
  /** 在时间线上播放的帧数 */
  durationInFrames: number;
  /** 从源视频第几帧开始取(裁掉片头) */
  startFromInFrames: number;
  volume: number;
};

type VideoManager = {
  register: (entry: VideoEntry) => void;
  unregister: (id: string) => void;
  getEntries: () => VideoEntry[];
};

const VideoManagerContext = createContext<VideoManager | null>(null);

export const VideoManagerProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const entries = useRef<Map<string, VideoEntry>>(new Map());

  const manager = useMemo<VideoManager>(
    () => ({
      register: (entry) => {
        entries.current.set(entry.id, entry);
      },
      unregister: (id) => {
        entries.current.delete(id);
      },
      getEntries: () => Array.from(entries.current.values()),
    }),
    [],
  );

  return (
    <VideoManagerContext.Provider value={manager}>
      {children}
    </VideoManagerContext.Provider>
  );
};

export const useVideoManager = (): VideoManager | null =>
  useContext(VideoManagerContext);
