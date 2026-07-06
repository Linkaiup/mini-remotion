import React from "react";
import {
  FrameProvider,
  PlaybackProvider,
  RenderAssetManagerProvider,
  VideoConfigProvider,
} from "../core";
import type { Composition } from "../core";

/**
 * 渲染层:把"当前帧的 React 树"变成可见画面。
 * 预览时直接交给浏览器绘制;它按 composition 的原始分辨率布局,
 * 再用 CSS transform scale 缩放到容器中显示(保证 seek/导出像素一致)。
 */
export const Preview: React.FC<{
  composition: Composition;
  frame: number;
  scale: number;
  playing: boolean;
  inputProps: Record<string, unknown>;
}> = ({ composition, frame, scale, playing, inputProps }) => {
  const Component = composition.component;

  return (
    <div
      style={{
        width: composition.width * scale,
        height: composition.height * scale,
        overflow: "hidden",
        borderRadius: 8,
        boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
      }}
    >
      <div
        style={{
          width: composition.width,
          height: composition.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          position: "relative",
        }}
      >
        <VideoConfigProvider
          config={{
            id: composition.id,
            width: composition.width,
            height: composition.height,
            fps: composition.fps,
            durationInFrames: composition.durationInFrames,
            mode: "preview",
          }}
        >
          <PlaybackProvider playing={playing}>
            <RenderAssetManagerProvider>
              <FrameProvider frame={frame}>
                <Component {...inputProps} />
              </FrameProvider>
            </RenderAssetManagerProvider>
          </PlaybackProvider>
        </VideoConfigProvider>
      </div>
    </div>
  );
};
