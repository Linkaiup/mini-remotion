export type SpringConfig = {
  mass: number;
  damping: number;
  stiffness: number;
};

const defaultConfig: SpringConfig = {
  mass: 1,
  damping: 10,
  stiffness: 100,
};

/**
 * 一个确定性的弹簧动画:给定帧号,返回 0 -> 1 的动画进度(可过冲)。
 * 因为是纯函数(相同 frame 相同结果),所以可随意 seek / 并发渲染。
 * 对照真实 Remotion: packages/core/src/spring/
 */
export const spring = ({
  frame,
  fps,
  from = 0,
  to = 1,
  config = {},
}: {
  frame: number;
  fps: number;
  from?: number;
  to?: number;
  config?: Partial<SpringConfig>;
}): number => {
  const { mass, damping, stiffness } = { ...defaultConfig, ...config };
  if (frame <= 0) return from;

  const t = frame / fps;
  const dampingRatio = damping / (2 * Math.sqrt(stiffness * mass));
  const angularFreq = Math.sqrt(stiffness / mass);

  let value: number;
  if (dampingRatio < 1) {
    // 欠阻尼:会过冲后回弹
    const dampedFreq = angularFreq * Math.sqrt(1 - dampingRatio * dampingRatio);
    const envelope = Math.exp(-dampingRatio * angularFreq * t);
    value =
      1 -
      envelope *
        (Math.cos(dampedFreq * t) +
          ((dampingRatio * angularFreq) / dampedFreq) *
            Math.sin(dampedFreq * t));
  } else {
    // 临界/过阻尼:平滑收敛
    const envelope = Math.exp(-angularFreq * t);
    value = 1 - envelope * (1 + angularFreq * t);
  }

  return from + (to - from) * value;
};
