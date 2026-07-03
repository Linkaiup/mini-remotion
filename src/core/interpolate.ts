export type ExtrapolateType = "clamp" | "extend";

export type InterpolateOptions = {
  extrapolateLeft?: ExtrapolateType;
  extrapolateRight?: ExtrapolateType;
  easing?: (t: number) => number;
};

/**
 * 把一个输入区间线性(可加缓动)映射到输出区间。
 * 这是 Remotion 里最常用的动画原语。
 * 对照真实 Remotion: packages/core/src/interpolate.ts
 */
export const interpolate = (
  input: number,
  inputRange: readonly number[],
  outputRange: readonly number[],
  options: InterpolateOptions = {},
): number => {
  if (inputRange.length !== outputRange.length) {
    throw new Error("inputRange 与 outputRange 长度必须一致");
  }
  if (inputRange.length < 2) {
    throw new Error("区间至少需要两个点");
  }

  const {
    extrapolateLeft = "clamp",
    extrapolateRight = "clamp",
    easing = (t) => t,
  } = options;

  // 找到 input 落在哪一段
  let i = 0;
  while (i < inputRange.length - 2 && input >= inputRange[i + 1]) {
    i++;
  }

  const inMin = inputRange[i];
  const inMax = inputRange[i + 1];
  const outMin = outputRange[i];
  const outMax = outputRange[i + 1];

  let progress = (input - inMin) / (inMax - inMin);

  if (progress < 0) {
    if (extrapolateLeft === "clamp") progress = 0;
  } else if (progress > 1) {
    if (extrapolateRight === "clamp") progress = 1;
  }

  const eased = easing(progress);
  return outMin + eased * (outMax - outMin);
};

export const Easing = {
  linear: (t: number) => t,
  easeInOut: (t: number) =>
    t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
  easeOut: (t: number) => 1 - Math.pow(1 - t, 3),
  easeIn: (t: number) => t * t * t,
};
