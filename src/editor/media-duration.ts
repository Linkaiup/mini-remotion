/** 在浏览器中探测视频/音频时长，返回帧数 */
const probeMediaDurationInFrames = (
  src: string,
  fps: number,
  kind: "video" | "audio",
): Promise<number> =>
  new Promise((resolve) => {
    const el = document.createElement(kind);
    el.preload = "metadata";
    const finish = (seconds: number) => {
      el.src = "";
      el.remove();
      resolve(Math.max(1, Math.round(seconds * fps)));
    };
    el.onloadedmetadata = () => finish(Number.isFinite(el.duration) ? el.duration : 0);
    el.onerror = () => finish(3);
    el.src = src;
  });

export const probeVideoDurationInFrames = (
  src: string,
  fps: number,
): Promise<number> => probeMediaDurationInFrames(src, fps, "video");

export const probeAudioDurationInFrames = (
  src: string,
  fps: number,
): Promise<number> => probeMediaDurationInFrames(src, fps, "audio");
