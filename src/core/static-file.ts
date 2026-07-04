/**
 * 静态资源引用。放在 public/ 下的文件会被 Vite 以根路径提供。
 * 对照真实 Remotion: packages/core/src/static-file.ts(它会解析到打包后的 public 目录)。
 */
export const staticFile = (path: string): string => {
  const clean = path.replace(/^\.?\//, "");
  return `/${clean}`;
};
