/**
 * Chromium Pool — 复用固定数量的浏览器进程并行截图。
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Browser = any;

export class ChromiumPool {
  private available: Browser[] = [];
  private waiters: Array<(b: Browser) => void> = [];
  private closed = false;

  private constructor(private browsers: Browser[]) {
    this.available = [...browsers];
  }

  static async create(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    puppeteer: any,
    size: number,
    launchArgs: string[],
  ): Promise<ChromiumPool> {
    const n = Math.max(1, size);
    const browsers = await Promise.all(
      Array.from({ length: n }, () =>
        puppeteer.launch({
          headless: true,
          protocolTimeout: 60000,
          args: launchArgs,
        }),
      ),
    );
    return new ChromiumPool(browsers);
  }

  get size(): number {
    return this.browsers.length;
  }

  async acquire(): Promise<Browser> {
    if (this.closed) throw new Error("ChromiumPool 已关闭");
    const b = this.available.pop();
    if (b) return b;
    return new Promise((resolve) => this.waiters.push(resolve));
  }

  release(browser: Browser): void {
    if (this.closed) return;
    const waiter = this.waiters.shift();
    if (waiter) waiter(browser);
    else this.available.push(browser);
  }

  async run<T>(fn: (browser: Browser) => Promise<T>): Promise<T> {
    const browser = await this.acquire();
    try {
      return await fn(browser);
    } finally {
      this.release(browser);
    }
  }

  async close(): Promise<void> {
    this.closed = true;
    await Promise.all(this.browsers.map((b) => b.close().catch(() => {})));
    this.browsers = [];
    this.available = [];
  }
}

/** 按 pool 并发上限执行一批任务 */
export const runPoolTasks = async <T>(
  pool: ChromiumPool,
  tasks: Array<(browser: Browser) => Promise<T>>,
): Promise<T[]> => {
  return Promise.all(tasks.map((task) => pool.run(task)));
};
