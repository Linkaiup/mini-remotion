import type React from "react";
import type { z } from "zod";

/**
 * 一个 Composition = 一段可渲染视频的元信息 + 内容组件。
 * 注意:这里不存"每帧内容",只存"如何根据帧号计算内容"(component)。
 */
export type CompositionMeta = {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
};

/**
 * 带 props 的 composition:
 *  - schema:用 zod 描述 props 的类型(可运行时校验 + 自动生成表单)
 *  - defaultProps:默认参数
 *  - component:接收 props 的组件
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Composition<T extends Record<string, any> = Record<string, any>> =
  CompositionMeta & {
    schema?: z.ZodType<T>;
    defaultProps: T;
    component: React.FC<T>;
  };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type AnyComposition = Composition<Record<string, any>>;
