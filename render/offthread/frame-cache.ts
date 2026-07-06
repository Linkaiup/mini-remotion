/**
 * 抽帧 LRU 缓存 — 同一视频相邻帧 seek 时避免重复跑 FFmpeg。
 */
export class FrameCache {
  private readonly maxEntries: number;
  private readonly map = new Map<string, Buffer>();

  constructor(maxEntries = 128) {
    this.maxEntries = maxEntries;
  }

  private key(filePath: string, time: number): string {
    return `${filePath}:${time.toFixed(4)}`;
  }

  get(filePath: string, time: number): Buffer | undefined {
    const k = this.key(filePath, time);
    const hit = this.map.get(k);
    if (!hit) return undefined;
    // LRU: 刷新顺序
    this.map.delete(k);
    this.map.set(k, hit);
    return hit;
  }

  set(filePath: string, time: number, png: Buffer): void {
    const k = this.key(filePath, time);
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, png);
    while (this.map.size > this.maxEntries) {
      const oldest = this.map.keys().next().value as string;
      this.map.delete(oldest);
    }
  }
}
