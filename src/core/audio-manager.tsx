import React, { createContext, useContext, useMemo, useRef } from "react";

/**
 * 音频时间线的一条记录:告诉渲染器"哪个音频文件、从第几帧开始、放多久、多大音量"。
 * 关键点:音频不靠截图!渲染器只画面截图,音频以这张"时间线清单"交给 FFmpeg 离线混流。
 * 对照真实 Remotion: 内部的 audio/asset 时间线收集机制。
 */
export type AudioEntry = {
  id: string;
  src: string;
  startInFrames: number; // 在整条时间线上的起始帧
  durationInFrames: number; // 播放帧数
  startFromInSeconds: number; // 从音频文件的第几秒开始取
  volume: number; // 0..1
};

type AudioManager = {
  register: (entry: AudioEntry) => void;
  unregister: (id: string) => void;
  getEntries: () => AudioEntry[];
};

const AudioManagerContext = createContext<AudioManager | null>(null);

export const AudioManagerProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const entries = useRef<Map<string, AudioEntry>>(new Map());

  const manager = useMemo<AudioManager>(
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
    <AudioManagerContext.Provider value={manager}>
      {children}
    </AudioManagerContext.Provider>
  );
};

export const useAudioManager = (): AudioManager | null =>
  useContext(AudioManagerContext);
