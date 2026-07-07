/**
 * 可视化编辑器项目模型 — 时间轴多轨道 + 片段属性。
 * 纯 JSON，可序列化、可 Agent 增量修改、可导出渲染。
 */

/** 入场/强调动画（检查器「动画」下拉） */
export type EditorAnimation =
  | "none"
  | "fadeIn"
  | "slideInLeft"
  | "slideInRight"
  | "springPop"
  | "bounceIn";

/** 画面特效（CSS 滤镜，预览/导出一致） */
export type EditorEffect =
  | "none"
  | "blur"
  | "grayscale"
  | "vignette"
  | "zoomPulse";

export type TrackKind = "video" | "text" | "audio" | "sticker";

export type ClipBase = {
  id: string;
  /** 在时间轴上的起始帧 */
  from: number;
  durationInFrames: number;
  x: number;
  y: number;
  /** 0..2，默认 1 */
  scale: number;
  /** 0..1，默认 1 */
  opacity: number;
  animation?: EditorAnimation;
  effect?: EditorEffect;
  /** 播放速率（视频/音频），默认 1 */
  playbackRate?: number;
  label?: string;
};

export type VideoClip = ClipBase & {
  type: "video";
  src: string;
  width: number;
  height: number;
  /** 默认 false：预览可听到原声；导出时未静音会混入音轨 */
  muted?: boolean;
  volume?: number;
};

export type TextClip = ClipBase & {
  type: "text";
  text: string;
  fontSize: number;
  color: string;
  fontWeight?: number;
};

export type ImageClip = ClipBase & {
  type: "image";
  src: string;
  width: number;
  height: number;
};

export type AudioClip = ClipBase & {
  type: "audio";
  src: string;
  volume?: number;
};

export type EditorClip = VideoClip | TextClip | ImageClip | AudioClip;

export type EditorTrack = {
  id: string;
  kind: TrackKind;
  name: string;
  clips: EditorClip[];
};

export type EditorProject = {
  id: string;
  name: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  background: string;
  tracks: EditorTrack[];
};

export type EditorSelection = {
  trackId: string;
  clipId: string;
} | null;

/** Agent 提议的单条修改 */
export type EditorPatchOp =
  | { op: "update_clip"; trackId: string; clipId: string; patch: Partial<EditorClip> }
  | { op: "move_clip"; trackId: string; clipId: string; from: number }
  | { op: "set_duration"; durationInFrames: number };

export type EditorPatch = {
  summary: string;
  ops: EditorPatchOp[];
};

export type AgentChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
  patch?: EditorPatch;
  patchStatus?: "pending" | "accepted" | "rejected";
};
