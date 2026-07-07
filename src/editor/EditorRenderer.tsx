import React from "react";
import {
  Audio,
  Img,
  OffthreadVideo,
  Sequence,
  useCurrentFrame,
  useVideoConfig,
  Video,
} from "../core";
import { useClipAnimationStyle } from "./animations";
import { useClipEffectStyle } from "./effects";
import type { EditorClip, EditorProject } from "./types";

const ClipVisualShell: React.FC<{
  clip: EditorClip;
  fps: number;
  children: React.ReactNode;
}> = ({ clip, fps, children }) => {
  const frame = useCurrentFrame();
  const anim = useClipAnimationStyle(clip.animation, fps, frame);
  const fx = useClipEffectStyle(clip.effect, clip.durationInFrames);

  if (clip.type === "audio") return null;

  const transforms: string[] = [];
  if (clip.scale !== 1) transforms.push(`scale(${clip.scale})`);
  if (anim.transform) transforms.push(String(anim.transform));
  if (fx.container.transform) transforms.push(String(fx.container.transform));

  const { transform: _fxT, ...fxRest } = fx.container;
  const baseOpacity = clip.opacity ?? 1;
  const animOpacity = typeof anim.opacity === "number" ? anim.opacity : 1;

  const style: React.CSSProperties = {
    position: "absolute",
    left: clip.x,
    top: clip.y,
    opacity: baseOpacity * animOpacity,
    transform: transforms.length > 0 ? transforms.join(" ") : undefined,
    transformOrigin:
      (anim.transformOrigin as string | undefined) ?? "center center",
    ...fxRest,
  };

  return (
    <div style={style}>
      {children}
      {fx.overlay ? <div style={fx.overlay} /> : null}
    </div>
  );
};

const EditorClipView: React.FC<{ clip: EditorClip; fps: number }> = ({
  clip,
  fps,
}) => {
  const config = useVideoConfig();
  const isPreview = config.mode === "preview";

  if (clip.type === "audio") {
    return (
      <Audio
        src={clip.src}
        volume={clip.volume ?? 1}
        durationInFrames={clip.durationInFrames}
      />
    );
  }

  return (
    <ClipVisualShell clip={clip} fps={fps}>
      {clip.type === "text" ? (
        <div
          style={{
            fontSize: clip.fontSize,
            color: clip.color,
            fontWeight: clip.fontWeight ?? 400,
            fontFamily: "system-ui, sans-serif",
            whiteSpace: "nowrap",
          }}
        >
          {clip.text}
        </div>
      ) : null}
      {clip.type === "image" ? (
        <Img
          src={clip.src}
          width={clip.width}
          height={clip.height}
          style={{ display: "block", objectFit: "cover" }}
        />
      ) : null}
      {clip.type === "video" ? (
        isPreview ? (
          <Video
            src={clip.src}
            style={{ width: clip.width, height: clip.height, objectFit: "cover" }}
            muted={clip.muted}
            volume={clip.volume ?? 1}
            durationInFrames={clip.durationInFrames}
          />
        ) : (
          <OffthreadVideo
            src={clip.src}
            style={{ width: clip.width, height: clip.height, objectFit: "cover" }}
            muted={clip.muted}
            durationInFrames={clip.durationInFrames}
          />
        )
      ) : null}
    </ClipVisualShell>
  );
};

/**
 * 将 EditorProject 渲染为可预览/可导出的 React 树。
 * 视频/音频轨分别映射到画面与 RenderAsset 登记。
 */
export const EditorRenderer: React.FC<{ project: EditorProject }> = ({
  project,
}) => (
  <div
    style={{
      position: "absolute",
      inset: 0,
      background: project.background,
      overflow: "hidden",
    }}
  >
    {project.tracks.map((track) =>
      track.clips.map((clip) => (
        <Sequence
          key={`${track.id}-${clip.id}`}
          from={clip.from}
          durationInFrames={clip.durationInFrames}
        >
          <EditorClipView clip={clip} fps={project.fps} />
        </Sequence>
      )),
    )}
  </div>
);
