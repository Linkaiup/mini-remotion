/**
 * 草稿层(可选层):给非程序员/可视化编辑器用的纯数据模型。
 * 它只是"数据",不含任何渲染逻辑;由 DraftRenderer 翻译成数据层的 React 组件。
 * 这一层对应真实 Remotion 生态里的 Editor Starter(建在核心之上)。
 */

export type DraftAnimation = "none" | "fadeIn" | "slideInLeft" | "springPop";

export type DraftItemBase = {
  id: string;
  from: number; // 起始帧
  durationInFrames: number; // 持续帧数
  x: number; // 左上角 x(相对画布)
  y: number; // 左上角 y
  animation?: DraftAnimation;
};

export type TextItem = DraftItemBase & {
  type: "text";
  text: string;
  fontSize: number;
  color: string;
  fontWeight?: number;
};

export type RectItem = DraftItemBase & {
  type: "rect";
  width: number;
  height: number;
  color: string;
  radius?: number;
};

export type DraftItem = TextItem | RectItem;

export type Draft = {
  id: string;
  width: number;
  height: number;
  fps: number;
  durationInFrames: number;
  background: string;
  items: DraftItem[];
};
