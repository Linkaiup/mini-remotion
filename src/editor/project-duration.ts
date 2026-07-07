import type { EditorProject } from "./types";

/** 根据所有片段计算时间轴应有的结束帧 */
export const computeProjectEndFrame = (project: EditorProject): number => {
  let end = 1;
  for (const track of project.tracks) {
    for (const clip of track.clips) {
      end = Math.max(end, clip.from + clip.durationInFrames);
    }
  }
  return end;
};

/** 将项目总时长扩展到能容纳全部片段（至少 1 帧） */
export const withSyncedProjectDuration = (
  project: EditorProject,
): EditorProject => {
  const end = computeProjectEndFrame(project);
  if (end <= project.durationInFrames) return project;
  return { ...project, durationInFrames: end };
};
