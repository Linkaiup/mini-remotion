import type { VideoTimeline } from "../timeline/types.js";

/** Composition 静态分析(结合时间线) */
export const lintComposition = (
  code: string,
  timeline: VideoTimeline,
): string[] => {
  const issues: string[] = [];

  const metaDur = code.match(/durationInFrames:\s*(\d+)/);
  if (metaDur && Number(metaDur[1]) !== timeline.durationInFrames) {
    issues.push(
      `meta.durationInFrames=${metaDur[1]} 与时间线 ${timeline.durationInFrames} 不一致`,
    );
  }

  const metaFps = code.match(/fps:\s*(\d+)/);
  if (metaFps && Number(metaFps[1]) !== timeline.fps) {
    issues.push(`meta.fps=${metaFps[1]} 与时间线 ${timeline.fps} 不一致`);
  }

  for (const scene of timeline.scenes) {
    const dur = scene.endFrame - scene.startFrame;
    const hasSeq = new RegExp(`from=\\{${scene.startFrame}\\}`).test(code);
    if (!hasSeq && timeline.scenes.length > 1) {
      issues.push(`未找到场景 "${scene.label}" (from=${scene.startFrame}) 的 Sequence`);
    }
    if (dur < 10) {
      issues.push(`场景 "${scene.label}" 过短 (${dur} 帧)`);
    }
  }

  for (const m of code.matchAll(/>([^<]{85,})</g)) {
    const text = m[1].trim();
    if (text && !text.includes("export")) {
      issues.push(`可见文本可能过长: ${text.slice(0, 36)}…`);
    }
  }

  if (timeline.assets?.length) {
    for (const asset of timeline.assets) {
      if (!code.includes(asset.path) && !code.includes(asset.path.split("/").pop()!)) {
        issues.push(`未引用素材 ${asset.path} (场景 ${asset.sceneId})`);
      }
    }
  }

  if (!/<Sequence[\s>]/.test(code) && timeline.scenes.length > 1) {
    issues.push("多场景时间线应使用 <Sequence>");
  }

  return issues;
};
