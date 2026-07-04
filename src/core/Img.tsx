import React, { useEffect, useRef, useState } from "react";
import { continueRender, delayRender } from "./delay-render";

/**
 * <Img>:自动挂接 delayRender 的图片组件。
 * 挂载即 delayRender()(阻塞渲染),图片加载完成再 continueRender()。
 * 这保证了渲染器截图时,图片一定已经画出来了 —— 不会截到半张空白。
 * 对照真实 Remotion: packages/core/src/Img.tsx
 */
export const Img: React.FC<
  React.ImgHTMLAttributes<HTMLImageElement> & { timeoutMs?: number }
> = ({ onLoad, onError, timeoutMs = 10000, ...props }) => {
  const [handle] = useState(() => delayRender());
  const done = useRef(false);
  const ref = useRef<HTMLImageElement>(null);

  const finish = () => {
    if (done.current) return;
    done.current = true;
    continueRender(handle);
  };

  useEffect(() => {
    const img = ref.current;
    // 图片可能已被浏览器缓存,此时 onLoad 不会触发,需主动检查
    if (img && img.complete && img.naturalWidth > 0) {
      finish();
    }

    const timer = window.setTimeout(() => {
      if (!done.current) {
        // eslint-disable-next-line no-console
        console.warn(`[mini-remotion] <Img> 加载超时: ${String(props.src)}`);
        finish();
      }
    }, timeoutMs);

    return () => {
      window.clearTimeout(timer);
      // 卸载时若尚未完成,释放句柄,避免永久阻塞渲染
      finish();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <img
      ref={ref}
      {...props}
      onLoad={(e) => {
        finish();
        onLoad?.(e);
      }}
      onError={(e) => {
        // eslint-disable-next-line no-console
        console.warn(`[mini-remotion] <Img> 加载失败: ${String(props.src)}`);
        finish();
        onError?.(e);
      }}
    />
  );
};
