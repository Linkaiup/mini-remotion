import React, { useCallback } from "react";
import {
  FrameProvider,
  PlaybackProvider,
  PreviewTransportLoop,
  PreviewTransportProvider,
  RenderAssetManagerProvider,
  VideoConfigProvider,
} from "../core";
import { EditorRenderer } from "./EditorRenderer";
import type { EditorProject } from "./types";

/** 编辑器内预览：声音主时钟驱动帧，画面跟随渲染 */
export const EditorPreview: React.FC<{
  project: EditorProject;
  frame: number;
  scale: number;
  playing: boolean;
  onTransportFrame: (frame: number) => void;
  onTransportEnd: () => void;
}> = ({
  project,
  frame,
  scale,
  playing,
  onTransportFrame,
  onTransportEnd,
}) => {
  const onFrame = useCallback(
    (f: number) => onTransportFrame(f),
    [onTransportFrame],
  );
  const onEnd = useCallback(() => onTransportEnd(), [onTransportEnd]);

  return (
    <div
      style={{
        width: project.width * scale,
        height: project.height * scale,
        overflow: "hidden",
        borderRadius: 8,
        boxShadow: "0 10px 40px rgba(0,0,0,0.45)",
        background: "#000",
      }}
    >
      <div
        style={{
          width: project.width,
          height: project.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
        }}
      >
        <VideoConfigProvider
          config={{
            id: project.id,
            width: project.width,
            height: project.height,
            fps: project.fps,
            durationInFrames: project.durationInFrames,
            mode: "preview",
          }}
        >
          <PlaybackProvider playing={playing}>
            <PreviewTransportProvider>
              <PreviewTransportLoop
                playing={playing}
                frame={frame}
                fps={project.fps}
                maxFrame={project.durationInFrames - 1}
                onFrame={onFrame}
                onEnd={onEnd}
              />
              <RenderAssetManagerProvider>
                <FrameProvider frame={frame}>
                  <div
                    id="mini-remotion-canvas"
                    style={{ width: project.width, height: project.height }}
                  >
                    <EditorRenderer project={project} />
                  </div>
                </FrameProvider>
              </RenderAssetManagerProvider>
            </PreviewTransportProvider>
          </PlaybackProvider>
        </VideoConfigProvider>
      </div>
    </div>
  );
};
