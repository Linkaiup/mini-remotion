import { staticFile } from "../core";
import { normalizeEditorProject } from "./normalize-project";
import { withSyncedProjectDuration } from "./project-duration";
import type { EditorProject } from "./types";

/** 默认示例项目（对齐 UI 稿：双视频片段 + 标题 + 旁白） */
export const createSampleEditorProject = (): EditorProject => ({
  id: "editor-demo",
  name: "未命名项目",
  width: 1280,
  height: 720,
  fps: 30,
  durationInFrames: 360,
  background: "#0f172a",
  tracks: [
    {
      id: "track-video",
      kind: "video",
      name: "视频",
      clips: [
        {
          id: "clip-video-a",
          type: "video",
          label: "片段 A",
          from: 0,
          durationInFrames: 180,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          src: staticFile("sample.mp4"),
          width: 1280,
          height: 720,
          animation: "fadeIn",
          effect: "none",
        },
        {
          id: "clip-video-b",
          type: "video",
          label: "片段 B",
          from: 180,
          durationInFrames: 180,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          src: staticFile("sample.mp4"),
          width: 1280,
          height: 720,
          animation: "fadeIn",
          effect: "vignette",
        },
      ],
    },
    {
      id: "track-text",
      kind: "text",
      name: "文字",
      clips: [
        {
          id: "clip-title",
          type: "text",
          label: "标题:产品发布",
          from: 30,
          durationInFrames: 300,
          x: 360,
          y: 280,
          scale: 1,
          opacity: 1,
          text: "产品发布",
          fontSize: 72,
          color: "#f8fafc",
          fontWeight: 800,
          animation: "fadeIn",
          effect: "none",
        },
      ],
    },
    {
      id: "track-sticker",
      kind: "sticker",
      name: "贴纸",
      clips: [],
    },
    {
      id: "track-audio",
      kind: "audio",
      name: "音频",
      clips: [
        {
          id: "clip-voice",
          type: "audio",
          label: "旁白 TTS",
          from: 0,
          durationInFrames: 300,
          x: 0,
          y: 0,
          scale: 1,
          opacity: 1,
          src: staticFile("audio.mp3"),
          volume: 0.85,
        },
      ],
    },
  ],
});

const STORAGE_KEY = "mini-remotion-editor-project";

export const loadEditorProject = (): EditorProject => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return withSyncedProjectDuration(
        normalizeEditorProject(JSON.parse(raw) as EditorProject),
      );
    }
  } catch {
    /* ignore */
  }
  return createSampleEditorProject();
};

export const saveEditorProject = (project: EditorProject): void => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(project));
};

export const downloadProjectJson = (project: EditorProject): void => {
  const blob = new Blob([JSON.stringify(project, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${project.name || "project"}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
