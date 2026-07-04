import React, { createContext, useContext } from "react";

/**
 * 播放态上下文:预览时用于让 <Audio>/<Video> 同步 播放/暂停。
 * 导出时恒为 false(导出不"播放",而是逐帧截图 + 离线混流)。
 */
export type PlaybackState = {
  playing: boolean;
};

const PlaybackContext = createContext<PlaybackState>({ playing: false });

export const PlaybackProvider: React.FC<{
  playing: boolean;
  children: React.ReactNode;
}> = ({ playing, children }) => (
  <PlaybackContext.Provider value={{ playing }}>
    {children}
  </PlaybackContext.Provider>
);

export const usePlayback = (): PlaybackState => useContext(PlaybackContext);
