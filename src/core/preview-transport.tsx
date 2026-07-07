import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
} from "react";

/** 预览时可作为时间主时钟的媒介源（通常为 <audio>） */
export type PreviewClockSource = {
  id: string;
  /** 越小越优先作为主时钟（视频原声优先于独立音轨） */
  priority: number;
  /** 从媒介 currentTime 换算出的全局时间轴帧 */
  getGlobalFrame: () => number | null;
  play: () => void;
  pause: () => void;
  seekToGlobalFrame: (frame: number) => void;
};

type PreviewTransportContextValue = {
  register: (source: PreviewClockSource) => () => void;
  getSources: () => PreviewClockSource[];
};

const PreviewTransportContext =
  createContext<PreviewTransportContextValue | null>(null);

export const PreviewTransportProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const sourcesRef = useRef<Map<string, PreviewClockSource>>(new Map());

  const register = useCallback((source: PreviewClockSource) => {
    sourcesRef.current.set(source.id, source);
    return () => {
      sourcesRef.current.delete(source.id);
    };
  }, []);

  const getSources = useCallback(
    () =>
      [...sourcesRef.current.values()].sort(
        (a, b) => a.priority - b.priority,
      ),
    [],
  );

  const value = useMemo(
    () => ({ register, getSources }),
    [register, getSources],
  );

  return (
    <PreviewTransportContext.Provider value={value}>
      {children}
    </PreviewTransportContext.Provider>
  );
};

export const usePreviewTransport = (): PreviewTransportContextValue => {
  const ctx = useContext(PreviewTransportContext);
  if (!ctx) {
    throw new Error("usePreviewTransport requires PreviewTransportProvider");
  }
  return ctx;
};

/** 可选注册：非预览模式（如导出）下为 null */
export const usePreviewTransportRegister = ():
  | PreviewTransportContextValue["register"]
  | null => useContext(PreviewTransportContext)?.register ?? null;

const pickMaster = (
  sources: PreviewClockSource[],
): PreviewClockSource | null => {
  for (const source of sources) {
    const f = source.getGlobalFrame();
    if (f != null && Number.isFinite(f)) {
      return source;
    }
  }
  return null;
};

/**
 * 预览播放循环：以声音媒介为主时钟，驱动全局帧；画面由帧号 seek 跟随。
 * 无可用音轨时回退到墙钟计时。
 */
export const PreviewTransportLoop: React.FC<{
  playing: boolean;
  frame: number;
  fps: number;
  maxFrame: number;
  onFrame: (frame: number) => void;
  onEnd: () => void;
}> = ({ playing, frame, fps, maxFrame, onFrame, onEnd }) => {
  const { getSources } = usePreviewTransport();
  const frameRef = useRef(frame);
  frameRef.current = frame;

  const wallClockRef = useRef<{ startWall: number; startFrame: number } | null>(
    null,
  );
  const masterIdRef = useRef<string | null>(null);

  React.useEffect(() => {
    if (!playing) {
      wallClockRef.current = null;
      masterIdRef.current = null;
      for (const source of getSources()) {
        source.pause();
      }
      return;
    }

    const startFrame = frameRef.current;
    wallClockRef.current = { startWall: performance.now(), startFrame };
    const sources = getSources();

    for (const source of sources) {
      source.seekToGlobalFrame(startFrame);
    }
    for (const source of sources) {
      source.play();
    }

    let raf = 0;
    const tick = () => {
      const list = getSources();
      const master = pickMaster(list);
      masterIdRef.current = master?.id ?? null;

      let globalFrame: number | null = null;
      if (master) {
        globalFrame = master.getGlobalFrame();
      }

      if (globalFrame == null && wallClockRef.current) {
        const { startWall, startFrame: sf } = wallClockRef.current;
        globalFrame =
          sf +
          Math.round(((performance.now() - startWall) / 1000) * fps);
      }

      if (globalFrame == null) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const clamped = Math.max(0, Math.min(maxFrame, Math.round(globalFrame)));
      onFrame(clamped);

      for (const source of list) {
        if (source.id === master?.id) continue;
        source.seekToGlobalFrame(clamped);
      }

      if (clamped >= maxFrame) {
        onEnd();
        return;
      }

      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, fps, maxFrame, getSources, onFrame, onEnd]);

  return null;
};
