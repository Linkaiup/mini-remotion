import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 驱动层:调度器。它唯一的职责是"决定现在该渲染第几帧",
 * 然后把帧号推给渲染层。播放 / 暂停 / seek 只是不同的推进策略。
 * 对照真实 Remotion: 浏览器端用 rAF 推进,渲染端用循环 setFrame。
 */
export const usePlayer = (opts: { fps: number; durationInFrames: number }) => {
  const { fps, durationInFrames } = opts;
  const [frame, setFrame] = useState(0);
  const [playing, setPlaying] = useState(false);

  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const frameRef = useRef(0);
  frameRef.current = frame;

  useEffect(() => {
    if (!playing) return;

    const frameDuration = 1000 / fps;
    lastTimeRef.current = performance.now();

    const tick = (now: number) => {
      const elapsed = now - lastTimeRef.current;
      if (elapsed >= frameDuration) {
        const advance = Math.floor(elapsed / frameDuration);
        lastTimeRef.current += advance * frameDuration;
        // 循环播放
        const next = (frameRef.current + advance) % durationInFrames;
        frameRef.current = next;
        setFrame(next);
      }
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, fps, durationInFrames]);

  const play = useCallback(() => setPlaying(true), []);
  const pause = useCallback(() => setPlaying(false), []);
  const toggle = useCallback(() => setPlaying((p) => !p), []);
  const seek = useCallback(
    (f: number) => {
      const clamped = Math.max(0, Math.min(durationInFrames - 1, Math.round(f)));
      frameRef.current = clamped;
      setFrame(clamped);
    },
    [durationInFrames],
  );

  return { frame, playing, play, pause, toggle, seek };
};
