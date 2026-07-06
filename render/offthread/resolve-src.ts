import { existsSync } from "node:fs";
import { resolve } from "node:path";

/**
 * 将浏览器侧的 src（如 staticFile("sample.mp4") → "/sample.mp4"）
 * 解析为 Node 可读本地路径。P4-a 仅支持 public/ 下本地文件。
 */
export const resolveVideoSrc = (src: string): string => {
  const decoded = decodeURIComponent(src);
  if (decoded.startsWith("http://") || decoded.startsWith("https://")) {
    throw new Error(`Offthread P4-a 暂不支持远程 URL: ${decoded}`);
  }

  const clean = decoded.replace(/^\//, "");
  const local = resolve("public", clean);
  if (!existsSync(local)) {
    throw new Error(`找不到视频文件: ${local} (src=${src})`);
  }
  return local;
};
