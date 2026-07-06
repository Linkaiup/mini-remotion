import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { VideoTimeline } from "../timeline/types.js";

export type HarnessCacheEntry = {
  promptHash: string;
  timeline?: VideoTimeline;
  code?: string;
  validatedAt?: string;
};

const CACHE_ROOT = resolve("out/cache");

export const hashPrompt = (parts: string[]): string =>
  createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 20);

const cachePath = (hash: string) => resolve(CACHE_ROOT, `${hash}.json`);

export const loadHarnessCache = async (
  hash: string,
): Promise<HarnessCacheEntry | null> => {
  try {
    const raw = await readFile(cachePath(hash), "utf-8");
    return JSON.parse(raw) as HarnessCacheEntry;
  } catch {
    return null;
  }
};

export const saveHarnessCache = async (
  entry: HarnessCacheEntry,
): Promise<void> => {
  await mkdir(CACHE_ROOT, { recursive: true });
  await writeFile(cachePath(entry.promptHash), JSON.stringify(entry, null, 2));
};

export const mergeHarnessCache = async (
  hash: string,
  patch: Partial<HarnessCacheEntry>,
): Promise<void> => {
  const prev = (await loadHarnessCache(hash)) ?? { promptHash: hash };
  await saveHarnessCache({ ...prev, ...patch, promptHash: hash });
};
