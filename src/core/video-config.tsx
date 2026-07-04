import React, { createContext, useContext } from "react";

/**
 * 视频配置上下文:让组件读到当前 composition 的元信息(fps/时长/尺寸),
 * 以及当前处于"预览"还是"导出"模式。
 * 对照真实 Remotion: useVideoConfig() / getRemotionEnvironment()
 */
export type VideoConfig = {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  mode: "preview" | "render";
};

const VideoConfigContext = createContext<VideoConfig | null>(null);

export const VideoConfigProvider: React.FC<{
  config: VideoConfig;
  children: React.ReactNode;
}> = ({ config, children }) => (
  <VideoConfigContext.Provider value={config}>
    {children}
  </VideoConfigContext.Provider>
);

export const useVideoConfig = (): VideoConfig => {
  const config = useContext(VideoConfigContext);
  if (!config) {
    throw new Error("useVideoConfig 必须在 composition 内部调用");
  }
  return config;
};
