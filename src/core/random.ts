/**
 * 确定性随机数:相同 seed 永远返回相同结果。
 * 渲染必须是确定性的,所以禁止直接用 Math.random()。
 * 对照真实 Remotion: packages/core/src/random.ts
 */
export const random = (seed: number | string): number => {
  let h = typeof seed === "string" ? hashString(seed) : seed;
  // mulberry32
  h |= 0;
  h = (h + 0x6d2b79f5) | 0;
  let t = Math.imul(h ^ (h >>> 15), 1 | h);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};

const hashString = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (Math.imul(31, hash) + str.charCodeAt(i)) | 0;
  }
  return hash;
};
