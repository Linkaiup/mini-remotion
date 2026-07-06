import React, {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useMemo,
  useRef,
} from "react";
import type { RenderAsset } from "./render-asset";

export type { RenderAsset, AudioEntry } from "./render-asset";
export { renderAssetToAudioEntry } from "./render-asset";

type RenderAssetManager = {
  register: (asset: RenderAsset) => void;
  unregister: (id: string) => void;
  /** 当前登记的全部资产(span 模型,跨帧有效) */
  getAssets: () => RenderAsset[];
  /**
   * 每帧截图前由 Node 调用(经 window.__miniRemotionCollectAssets)。
   * 返回当前快照;不清空登记,因 <Audio>/<Video> 用 mount 期 span 描述。
   */
  collectAssets: () => RenderAsset[];
};

const RenderAssetManagerContext = createContext<RenderAssetManager | null>(null);

/**
 * 统一媒体资产登记器(P4-b)。
 * 取代原 AudioManager + VideoManager 双轨,供 FFmpeg 混流使用。
 * 对照 Remotion RenderAssetManagerProvider。
 */
export const RenderAssetManagerProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const assetsRef = useRef<Map<string, RenderAsset>>(new Map());

  const register = useCallback((asset: RenderAsset) => {
    assetsRef.current.set(asset.id, asset);
  }, []);

  const unregister = useCallback((id: string) => {
    assetsRef.current.delete(id);
  }, []);

  const getAssets = useCallback(
    () => Array.from(assetsRef.current.values()),
    [],
  );

  const collectAssets = useCallback(
    () => Array.from(assetsRef.current.values()),
    [],
  );

  const manager = useMemo<RenderAssetManager>(
    () => ({ register, unregister, getAssets, collectAssets }),
    [register, unregister, getAssets, collectAssets],
  );

  // 挂到 window,供 Puppeteer 每帧抓取(对照 remotion_collectAssets)
  useLayoutEffect(() => {
    window.__miniRemotionCollectAssets = () => manager.collectAssets();
    return () => {
      delete window.__miniRemotionCollectAssets;
    };
  }, [manager]);

  return (
    <RenderAssetManagerContext.Provider value={manager}>
      {children}
    </RenderAssetManagerContext.Provider>
  );
};

export const useRenderAssetManager = (): RenderAssetManager | null =>
  useContext(RenderAssetManagerContext);
