import type { EditorProject, EditorTrack, TrackKind } from "./types";

const TRACK_DEFS: { kind: TrackKind; id: string; name: string }[] = [
  { kind: "video", id: "track-video", name: "视频" },
  { kind: "text", id: "track-text", name: "文字" },
  { kind: "sticker", id: "track-sticker", name: "贴纸" },
  { kind: "audio", id: "track-audio", name: "音频" },
];

/** 补全缺失轨道（兼容旧版 localStorage 项目） */
export const normalizeEditorProject = (
  raw: EditorProject,
): EditorProject => {
  const tracks: EditorTrack[] = TRACK_DEFS.map((def) => {
    const existing = raw.tracks?.find((t) => t.kind === def.kind);
    if (existing) {
      return {
        ...existing,
        id: existing.id || def.id,
        kind: def.kind,
        name: existing.name || def.name,
        clips: Array.isArray(existing.clips) ? existing.clips : [],
      };
    }
    return { id: def.id, kind: def.kind, name: def.name, clips: [] };
  });

  return {
    id: raw.id ?? "editor-demo",
    name: raw.name ?? "未命名项目",
    width: raw.width ?? 1280,
    height: raw.height ?? 720,
    fps: raw.fps ?? 30,
    durationInFrames: raw.durationInFrames ?? 360,
    background: raw.background ?? "#0f172a",
    tracks,
  };
};

export const findTrackByKind = (
  project: EditorProject,
  kind: TrackKind,
): EditorTrack | undefined => project.tracks.find((t) => t.kind === kind);
