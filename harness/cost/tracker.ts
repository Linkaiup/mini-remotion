/** 单次可计费操作 */
export type CostEntry = {
  kind: "llm" | "image" | "tts";
  label: string;
  promptTokens?: number;
  completionTokens?: number;
  units?: number;
  estimatedUsd: number;
  latencyMs?: number;
};

export type CostSummary = {
  entries: CostEntry[];
  totalUsd: number;
  totalLlmTokens: number;
};

export class CostTracker {
  private entries: CostEntry[] = [];

  record(entry: CostEntry): void {
    this.entries.push(entry);
  }

  get totalUsd(): number {
    return this.entries.reduce((s, e) => s + e.estimatedUsd, 0);
  }

  get totalLlmTokens(): number {
    return this.entries.reduce(
      (s, e) => s + (e.promptTokens ?? 0) + (e.completionTokens ?? 0),
      0,
    );
  }

  summary(): CostSummary {
    return {
      entries: [...this.entries],
      totalUsd: this.totalUsd,
      totalLlmTokens: this.totalLlmTokens,
    };
  }

  assertWithinBudget(maxUsd: number | undefined): void {
    if (maxUsd === undefined || maxUsd <= 0) return;
    if (this.totalUsd > maxUsd) {
      throw new Error(
        `预算超限: $${this.totalUsd.toFixed(4)} > $${maxUsd.toFixed(4)}`,
      );
    }
  }
}

/** 当前 Harness 运行的 tracker(供深层模块记录) */
let active: CostTracker | null = null;

export const setActiveCostTracker = (tracker: CostTracker | null): void => {
  active = tracker;
};

export const getActiveCostTracker = (): CostTracker | null => active;
