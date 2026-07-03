/**
 * 处理异步资源(图片/字体/数据)的"阻塞句柄"机制。
 * 渲染器在截图前会等待 window.__miniRemotionReady === true。
 * 用户在开始加载时调用 delayRender(),加载完调用 continueRender(handle)。
 * 对照真实 Remotion: packages/core/src/delay-render.ts
 */
const pending = new Set<number>();
let nextHandle = 0;

const updateReadyFlag = () => {
  if (typeof window !== "undefined") {
    (window as unknown as Record<string, unknown>).__miniRemotionReady =
      pending.size === 0;
  }
};

export const delayRender = (): number => {
  const handle = nextHandle++;
  pending.add(handle);
  updateReadyFlag();
  return handle;
};

export const continueRender = (handle: number): void => {
  pending.delete(handle);
  updateReadyFlag();
};

export const getPendingCount = (): number => pending.size;
