/** 规划中的图像素材(生成前) */
export type PlannedAsset = {
  id: string;
  sceneId: string;
  prompt: string;
};

/** 已落盘的图像素材 */
export type ResolvedAsset = PlannedAsset & {
  /** public/ 下相对路径, 如 generated/bg-scene-0.png */
  path: string;
  sourceUrl?: string;
};

export type AssetPlan = {
  assets: PlannedAsset[];
};

export type AssetGenerationResult = {
  assets: ResolvedAsset[];
  skipped: boolean;
  skipReason?: string;
};
