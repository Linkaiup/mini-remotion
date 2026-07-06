/**
 * 拼装 Offthread 代理 URL。
 * 对照 Remotion packages/core/src/video/offthread-video-source.ts
 */
export const getOffthreadVideoSource = ({
  src,
  currentTime,
  transparent = false,
  toneMapped = true,
}: {
  src: string;
  currentTime: number;
  transparent?: boolean;
  toneMapped?: boolean;
}): string => {
  const port =
    typeof window !== "undefined"
      ? window.__miniRemotionProxyPort
      : undefined;
  if (!port) {
    throw new Error(
      "缺少 __miniRemotionProxyPort: 导出时请由渲染器注入 ?proxyPort= 或 window 变量",
    );
  }

  const params = new URLSearchParams({
    src,
    time: String(Math.max(0, currentTime)),
    transparent: String(transparent),
    toneMapped: String(toneMapped),
  });

  return `http://127.0.0.1:${port}/proxy?${params.toString()}`;
};
