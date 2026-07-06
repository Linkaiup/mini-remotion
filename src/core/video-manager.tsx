/**
 * @deprecated 请使用 RenderAssetManager + type:'video' 资产。保留空壳避免旧 import 断裂。
 */
export type { RenderAsset as VideoEntry } from "./render-asset";
export {
  RenderAssetManagerProvider as VideoManagerProvider,
  useRenderAssetManager as useVideoManager,
} from "./render-asset-manager";
