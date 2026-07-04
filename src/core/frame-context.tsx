import React, { createContext, useContext } from "react";

/**
 * 数据层的核心:整个视频的"状态"其实只有一个数字 —— 当前帧号。
 * 视频内容不被逐帧存储,而是由组件根据这个帧号实时计算(纯函数 frame -> 画面)。
 */
const FrameContext = createContext<number>(0);

/**
 * 时间偏移上下文,供 <Sequence> 使用:让子组件读到的是"相对帧号"。
 */
const SequenceContext = createContext<{ offset: number }>({ offset: 0 });

export const FrameProvider: React.FC<{
  frame: number;
  children: React.ReactNode;
}> = ({ frame, children }) => {
  return <FrameContext.Provider value={frame}>{children}</FrameContext.Provider>;
};

/**
 * 读取当前帧。若处于 <Sequence> 内,返回的是相对该 Sequence 起点的帧号。
 * 对照真实 Remotion: packages/core/src/use-current-frame.ts
 */
export const useCurrentFrame = (): number => {
  const absolute = useContext(FrameContext);
  const { offset } = useContext(SequenceContext);
  return absolute - offset;
};

/**
 * 读取当前所在 <Sequence> 的绝对起始帧(顶层为 0)。
 * <Audio>/<Video> 用它来确定自己在整条时间线上的起点。
 */
export const useSequenceOffset = (): number =>
  useContext(SequenceContext).offset;

/**
 * <Sequence>:在时间轴上平移子内容。from 之前和 durationInFrames 之后不渲染。
 * 对照真实 Remotion: packages/core/src/Sequence.tsx
 */
export const Sequence: React.FC<{
  from: number;
  durationInFrames: number;
  children: React.ReactNode;
}> = ({ from, durationInFrames, children }) => {
  const parent = useContext(SequenceContext);
  const absolute = useContext(FrameContext);
  const localFrame = absolute - parent.offset;

  const isActive = localFrame >= from && localFrame < from + durationInFrames;
  if (!isActive) {
    return null;
  }

  return (
    <SequenceContext.Provider value={{ offset: parent.offset + from }}>
      {children}
    </SequenceContext.Provider>
  );
};
