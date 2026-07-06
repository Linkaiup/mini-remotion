/** 拼装 Headless 页面 URL(含 Offthread proxyPort) */
export const buildHeadlessUrl = (opts: {
  baseUrl: string;
  comp: string;
  propsB64?: string;
  proxyPort?: number;
}): string => {
  const propsQuery = opts.propsB64
    ? `&props=${encodeURIComponent(opts.propsB64)}`
    : "";
  const proxyQuery = opts.proxyPort ? `&proxyPort=${opts.proxyPort}` : "";
  return `${opts.baseUrl}/?headless=1&comp=${encodeURIComponent(opts.comp)}${proxyQuery}${propsQuery}`;
};
