import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import OpenAI from "openai";

export type SeedreamOptions = {
  prompt: string;
  outPath: string;
  size?: string;
  watermark?: boolean;
};

const defaultClient = (): OpenAI => {
  const apiKey = process.env.ARK_API_KEY;
  if (!apiKey) throw new Error("缺少 ARK_API_KEY");
  return new OpenAI({
    apiKey,
    baseURL:
      process.env.SEEDREAM_BASE_URL ??
      "https://ark.cn-beijing.volces.com/api/v3",
  });
};

/** 火山方舟 Seedream 5.0 — OpenAI SDK images.generate */
export const generateSeedreamImage = async (
  opts: SeedreamOptions,
): Promise<{ url: string; localPath: string }> => {
  const client = defaultClient();
  const model =
    process.env.SEEDREAM_MODEL ?? "doubao-seedream-5-0-260128";
  const watermark = opts.watermark ?? process.env.SEEDREAM_WATERMARK !== "false";

  // Volcengine Ark 扩展字段 watermark
  const response = await client.images.generate({
    model,
    prompt: opts.prompt,
    size: (opts.size ?? process.env.SEEDREAM_SIZE ?? "2K") as "1024x1024",
    response_format: "url",
    watermark,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any);

  const url = response.data?.[0]?.url;
  if (!url) throw new Error("Seedream 未返回图片 URL");

  const absPath = resolve(opts.outPath);
  await mkdir(dirname(absPath), { recursive: true });

  const imgRes = await fetch(url);
  if (!imgRes.ok) {
    throw new Error(`下载图片失败: ${imgRes.status} ${imgRes.statusText}`);
  }
  const buf = Buffer.from(await imgRes.arrayBuffer());
  await writeFile(absPath, buf);

  return { url, localPath: absPath };
};

export const isSeedreamAvailable = (): boolean =>
  Boolean(process.env.ARK_API_KEY) &&
  process.env.MINI_REMOTION_IMAGES !== "noop";
