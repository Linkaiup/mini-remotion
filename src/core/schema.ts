import { z } from "zod";

/**
 * 用 zod 描述 props 的 schema。schema 有两个用途:
 *  1) 运行时校验(渲染前挡住非法 props)
 *  2) 在 Studio 里自动生成可视化表单(见 PropsEditor)
 * 对照真实 Remotion: @remotion/zod-types 的 zColor 等。
 */

// 颜色字段:本质是 string,用 description 打标记,让表单渲染成取色器
export const COLOR_MARKER = "__color__";
export const zColor = () => z.string().describe(COLOR_MARKER);

export { z };
