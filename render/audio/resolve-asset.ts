/**
 * 将 staticFile 路径解析为本地绝对路径(public/ 下)。
 */
import { existsSync } from "node:fs";
import { resolve } from "node:path";

export const resolvePublicAsset = (src: string): string => {
  const clean = decodeURIComponent(src).replace(/^\//, "");
  const local = resolve("public", clean);
  if (!existsSync(local)) {
    throw new Error(`找不到媒体文件: ${local} (src=${src})`);
  }
  return local;
};
