import type { EditorPatch, EditorPatchOp, EditorProject } from "./types";

const updateClipInProject = (
  project: EditorProject,
  trackId: string,
  clipId: string,
  patch: Record<string, unknown>,
): EditorProject => ({
  ...project,
  tracks: project.tracks.map((t) =>
    t.id !== trackId
      ? t
      : {
          ...t,
          clips: t.clips.map((c) =>
            c.id === clipId ? ({ ...c, ...patch } as typeof c) : c,
          ),
        },
  ),
});

/** 将 Agent / 用户确认的补丁应用到项目（不可变更新） */
export const applyEditorPatch = (
  project: EditorProject,
  patch: EditorPatch,
): EditorProject => {
  let next = project;
  for (const op of patch.ops) {
    next = applyEditorOp(next, op);
  }
  return next;
};

export const applyEditorOp = (
  project: EditorProject,
  op: EditorPatchOp,
): EditorProject => {
  switch (op.op) {
    case "update_clip":
      return updateClipInProject(project, op.trackId, op.clipId, op.patch);
    case "move_clip":
      return updateClipInProject(project, op.trackId, op.clipId, {
        from: Math.max(0, op.from),
      });
    case "set_duration":
      return { ...project, durationInFrames: op.durationInFrames };
    default:
      return project;
  }
};

/** 生成补丁的可读 diff 行（Agent 面板展示） */
export const describePatchOps = (patch: EditorPatch): string[] => {
  const lines: string[] = [];
  for (const op of patch.ops) {
    if (op.op === "update_clip") {
      const keys = Object.keys(op.patch);
      for (const k of keys) {
        const v = (op.patch as Record<string, unknown>)[k];
        lines.push(`+ ${op.clipId}.${k} → ${JSON.stringify(v)}`);
      }
    } else if (op.op === "move_clip") {
      lines.push(`~ ${op.clipId} 起始帧 → ${op.from}`);
    } else if (op.op === "set_duration") {
      lines.push(`~ 总时长 → ${op.durationInFrames} 帧`);
    }
  }
  return lines.length > 0 ? lines : [patch.summary];
};
