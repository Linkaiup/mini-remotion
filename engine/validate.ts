import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { ensureRenderSite } from "./render-site.js";
import { ensureOffthreadServer } from "../render/offthread/index.js";
import { buildHeadlessUrl } from "../render/headless-url.js";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export const runTsc = async (): Promise<string | null> =>
  new Promise((res) => {
    const child = spawn("./node_modules/.bin/tsc", ["--noEmit"], {
      cwd: resolve("."),
    });
    let output = "";
    const append = (d: Buffer) => {
      output += d.toString();
    };
    child.stdout.on("data", append);
    child.stderr.on("data", append);
    child.on("close", (code) => {
      if (code === 0) res(null);
      else res(output.trim() || `tsc exited with code ${code}`);
    });
    child.on("error", () => res("无法运行 tsc"));
  });

export const smokeTestAtFrames = async (
  frames: number[],
): Promise<string | null> => {
  const baseUrl = await ensureRenderSite();
  const offthread = await ensureOffthreadServer();
  await wait(1200);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let puppeteer: any;
  try {
    puppeteer = await import("puppeteer" as string);
  } catch {
    return "需要 puppeteer(npm install -D puppeteer)";
  }

  process.env.PUPPETEER_CACHE_DIR = resolve(".puppeteer-cache");

  const browser = await puppeteer.launch({
    headless: true,
    protocolTimeout: 30000,
    args: [
      "--disable-background-timer-throttling",
      "--disable-backgrounding-occluded-windows",
      "--disable-renderer-backgrounding",
    ],
  });

  const errors: string[] = [];
  const page = await browser.newPage();
  page.on("pageerror", (e: Error) => errors.push(e.message));
  page.on("console", (msg: { type: () => string; text: () => string }) => {
    if (msg.type() !== "error") return;
    const text = msg.text();
    if (/Failed to load resource.*404/i.test(text)) return;
    errors.push(text);
  });

  try {
    const url = buildHeadlessUrl({
      baseUrl,
      comp: "GeneratedVideo",
      proxyPort: offthread.port,
    });
    await page.goto(`${url}&_t=${Date.now()}`, { waitUntil: "networkidle0", timeout: 20000 });
    await page.waitForFunction(() => Boolean(window.__miniRemotionMeta), {
      timeout: 15000,
    });

    for (const frame of frames) {
      await page.evaluate((f: number) => window.__miniRemotionSetFrame?.(f), frame);
      await page.evaluate(
        () =>
          new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          ),
      );
      await page.waitForFunction(() => window.__miniRemotionReady === true, {
        timeout: 10000,
      });
      if (!(await page.$("#mini-remotion-canvas"))) {
        errors.push(`帧 ${frame}: 找不到 #mini-remotion-canvas`);
      }
    }
  } catch (e) {
    errors.push(e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
  }

  return errors.length > 0 ? errors.join("\n") : null;
};

export const smokeTest = async (): Promise<string | null> =>
  smokeTestAtFrames([0]);

export const runValidate = async (): Promise<{
  ok: boolean;
  tsc?: string;
  smoke?: string;
}> => {
  const tsc = await runTsc();
  if (tsc) return { ok: false, tsc };
  const smoke = await smokeTest();
  if (smoke) return { ok: false, smoke };
  return { ok: true };
};

// CLI: tsx engine/validate.ts → JSON
const main = async () => {
  const result = await runValidate();
  console.log(JSON.stringify(result));
  if (!result.ok) process.exit(1);
};

import { pathToFileURL } from "node:url";

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().catch((e) => {
    console.log(JSON.stringify({ ok: false, error: String(e) }));
    process.exit(1);
  });
}
