import React from "react";
import {
  Easing,
  Sequence,
  interpolate,
  spring,
  useCurrentFrame,
} from "../core";
import type { Draft, DraftAnimation, DraftItem } from "./types";

/**
 * 草稿层 → 数据层的翻译器(桥梁)。
 * 把纯 JSON 的每个 item 翻译成一个受 useCurrentFrame() 驱动的 React 组件。
 * 翻译后,它就和"手写代码的视频"完全一样,享受同样的纯函数/确定性特性。
 */

const useAnimationStyle = (
  animation: DraftAnimation | undefined,
  fps: number,
): React.CSSProperties => {
  // 注意:此处的 frame 是 Sequence 内的相对帧(从该 item 出现开始计)
  const frame = useCurrentFrame();

  switch (animation) {
    case "fadeIn": {
      const opacity = interpolate(frame, [0, 15], [0, 1], {
        easing: Easing.easeOut,
      });
      return { opacity };
    }
    case "slideInLeft": {
      const progress = spring({ frame, fps, config: { damping: 14 } });
      const translateX = interpolate(progress, [0, 1], [-60, 0]);
      return { opacity: progress, transform: `translateX(${translateX}px)` };
    }
    case "springPop": {
      const scale = spring({ frame, fps, config: { damping: 9 } });
      return {
        opacity: interpolate(frame, [0, 8], [0, 1]),
        transform: `scale(${scale})`,
        transformOrigin: "left center",
      };
    }
    case "none":
    default:
      return {};
  }
};

const DraftItemView: React.FC<{ item: DraftItem; fps: number }> = ({
  item,
  fps,
}) => {
  const animStyle = useAnimationStyle(item.animation, fps);

  const base: React.CSSProperties = {
    position: "absolute",
    left: item.x,
    top: item.y,
    ...animStyle,
  };

  if (item.type === "text") {
    return (
      <div
        style={{
          ...base,
          fontSize: item.fontSize,
          color: item.color,
          fontWeight: item.fontWeight ?? 400,
          fontFamily: "system-ui, -apple-system, sans-serif",
          whiteSpace: "nowrap",
        }}
      >
        {item.text}
      </div>
    );
  }

  return (
    <div
      style={{
        ...base,
        width: item.width,
        height: item.height,
        background: item.color,
        borderRadius: item.radius ?? 0,
      }}
    />
  );
};

/**
 * 生成一个 Composition 用的组件。返回的组件本身就是数据层的一等公民。
 */
export const makeDraftComponent = (draft: Draft): React.FC => {
  const DraftComponent: React.FC = () => {
    return (
      <div
        style={{
          position: "absolute",
          inset: 0,
          background: draft.background,
          overflow: "hidden",
        }}
      >
        {draft.items.map((item) => (
          <Sequence
            key={item.id}
            from={item.from}
            durationInFrames={item.durationInFrames}
          >
            <DraftItemView item={item} fps={draft.fps} />
          </Sequence>
        ))}
      </div>
    );
  };
  return DraftComponent;
};
