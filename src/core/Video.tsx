import React, { useEffect, useId, useRef } from "react";
import { continueRender, delayRender } from "./delay-render";
import { useCurrentFrame, useSequenceOffset } from "./frame-context";
import { usePlayback } from "./playback";
import { useVideoConfig } from "./video-config";
import { useVideoManager } from "./video-manager";

/**
 * <Video>:嵌入外部视频片段。
 *
 * 两种运行模式:
 *  - **预览(preview)**:渲染可见 <video>,跟随播放态 seek / play / pause
 *  - **导出(render)**:同样渲染 <video>(非隐藏!),每帧 seek 到正确时间点,
 *    由 Puppeteer 截图进画面。导出时静音,避免与 <Audio> 轨冲突。
 *
 * 加载与 seek 均挂接 delayRender,保证截图前视频帧已绘制完成。
 * 对照真实 Remotion: packages/core/src/video/Video.tsx(简化版,无 OffthreadVideo)
 */
export const Video: React.FC<{
  src: string;
  volume?: number;
  /** 从源视频第几帧开始取 */
  startFrom?: number;
  /** 在时间线上播放多少帧;默认到 composition 结束 */
  durationInFrames?: number;
  muted?: boolean;
  style?: React.CSSProperties;
}> = ({
  src,
  volume = 1,
  startFrom = 0,
  durationInFrames,
  muted,
  style,
}) => {
  const config = useVideoConfig();
  const { playing } = usePlayback();
  const offset = useSequenceOffset();
  const manager = useVideoManager();
  const id = useId();
  const frame = useCurrentFrame();
  const ref = useRef<HTMLVideoElement>(null);

  const dur = durationInFrames ?? config.durationInFrames - offset;
  const clampedVolume = Math.max(0, Math.min(1, volume));
  /** 导出模式强制静音;预览可听 */
  const isMuted = muted ?? config.mode === "render";

  // 登记视频元数据(供 Headless 调试与未来 FFmpeg 扩展)
  useEffect(() => {
    if (!manager) return;
    manager.register({
      id,
      src,
      startInFrames: offset,
      durationInFrames: dur,
      startFromInFrames: startFrom,
      volume: clampedVolume,
    });
    return () => manager.unregister(id);
  }, [manager, id, src, offset, dur, startFrom, clampedVolume]);

  // 首次加载:阻塞渲染直到视频可 seek
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const handle = delayRender();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      continueRender(handle);
    };

    const onReady = () => finish();
    el.addEventListener("loadeddata", onReady, { once: true });
    el.addEventListener("error", onReady, { once: true });

    if (el.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      finish();
    }

    const timer = window.setTimeout(() => {
      // eslint-disable-next-line no-console
      console.warn(`[mini-remotion] <Video> 加载超时: ${src}`);
      finish();
    }, 15000);

    return () => {
      window.clearTimeout(timer);
      el.removeEventListener("loadeddata", onReady);
      el.removeEventListener("error", onReady);
      finish();
    };
  }, [src]);

  // 预览:音量
  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (el) el.volume = clampedVolume;
  }, [clampedVolume, config.mode]);

  // 每帧 seek:预览与导出共用逻辑,导出时额外 delayRender 等待 seeked
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const localFrame = Math.max(0, Math.min(frame, dur - 1));
    const targetSec = (startFrom + localFrame) / config.fps;

    const handle =
      config.mode === "render" ? delayRender() : null;
    let done = false;
    const finish = () => {
      if (!handle || done) return;
      done = true;
      continueRender(handle);
    };

    const onSeeked = () => finish();

    if (handle) {
      el.addEventListener("seeked", onSeeked, { once: true });
    }

    if (Math.abs(el.currentTime - targetSec) > 0.04) {
      el.currentTime = targetSec;
    } else if (handle) {
      // 已在目标时间,无需等待 seeked
      finish();
    }

    return () => {
      el.removeEventListener("seeked", onSeeked);
      finish();
    };
  }, [frame, startFrom, dur, config.fps, config.mode]);

  // 预览:播放/暂停
  useEffect(() => {
    if (config.mode !== "preview") return;
    const el = ref.current;
    if (!el) return;
    if (playing) {
      el.play().catch(() => {
        /* 浏览器自动播放策略 */
      });
    } else {
      el.pause();
    }
  }, [playing, config.mode]);

  return (
    <video
      ref={ref}
      src={src}
      muted={isMuted}
      playsInline
      preload="auto"
      style={{
        position: "absolute",
        objectFit: "cover",
        ...style,
      }}
    />
  );
};
