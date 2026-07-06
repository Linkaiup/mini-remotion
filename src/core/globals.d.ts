/**
 * Headless / Offthread 渲染时注入到 window 的全局标志。
 */
export {};

declare global {
  interface Window {
    __miniRemotionProxyPort?: number;
    __miniRemotionVideoEnabled?: boolean;
    /** 是否登记音频/视频音轨资产(默认 true) */
    __miniRemotionAudioEnabled?: boolean;
    __miniRemotionCollectAssets?: () => import("./render-asset").RenderAsset[];
  }
}
