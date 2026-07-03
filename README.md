# Mini Remotion

一个从零实现的极简版 Remotion,用来讲清「用 React 写视频」的核心原理。严格按**四层架构**组织:

```
草稿层(可选)  →  数据层(核心)  →  渲染层  →  驱动层
  JSON 数据        frame → 画面      变成像素     决定渲染第几帧
```

## 核心思想

> **视频 = 一个「当前帧号」可被外部控制的 React 应用;渲染 = 逐帧截图再用 FFmpeg 合成。**

视频内容**不逐帧存储**,而是由组件根据 `useCurrentFrame()` 实时计算(纯函数)。因此同一帧永远渲染出同样画面 —— 这带来两个关键能力:可随意 seek、可并发渲染。

## 四层对应的文件

| 层 | 职责 | 文件 |
|----|------|------|
| **① 草稿层** | 纯 JSON 数据模型(给可视化编辑器用) | `src/draft/types.ts`、`src/draft/sample-draft.ts` |
| 草稿→数据桥 | 把 JSON 翻译成 React 组件 | `src/draft/DraftRenderer.tsx` |
| **② 数据层** | `frame → 画面` 的核心运行时 | `src/core/*`(`useCurrentFrame` / `interpolate` / `spring` / `random` / `Sequence` / `delayRender`) |
| 数据层清单 | 注册所有 composition | `src/compositions.tsx` |
| **③ 渲染层** | 把当前帧的 React 树变成像素 | `src/render/Preview.tsx`(预览)、`src/render/Headless.tsx`(导出桥接)、`render/render.ts`(Puppeteer+FFmpeg) |
| **④ 驱动层** | 调度器:决定渲染第几帧 | `src/drive/usePlayer.ts`(播放/暂停/seek)、`render/render.ts`(导出循环) |

数据层与渲染层的连接点是 `FrameProvider`;驱动层与数据层的连接点是「设置当前帧号」(浏览器端 setState / 导出端 `window.__miniRemotionSetFrame`)。

## 运行

```bash
npm install
npm run dev        # 打开 http://localhost:5173
```

Studio 里可切换两个示例:
- **DraftDemo** —— 由 `src/draft/sample-draft.ts` 的 JSON 草稿翻译而来(走完整四层)。
- **CodeDemo** —— 纯代码视频(不经过草稿层),演示数据层完全能力。

快捷键:`空格`=播放/暂停,`←/→`=逐帧。

## 导出为 mp4(可选)

需要额外安装 Puppeteer,并确保系统有 FFmpeg(mac: `brew install ffmpeg`):

```bash
npm install -D puppeteer
npm run dev                                   # 终端 A:保持 dev server 运行
npm run render -- --comp CodeDemo --out out/video.mp4   # 终端 B
```

## 与真实 Remotion 的对应

| Mini Remotion | 真实 Remotion 源码 |
|---------------|--------------------|
| `useCurrentFrame` | `packages/core/src/use-current-frame.ts` |
| `FrameProvider` / 帧状态 | `packages/core/src/TimelineContext.tsx` |
| `window.__miniRemotionSetFrame` | `window.remotion_setFrame` |
| `Sequence` | `packages/core/src/Sequence.tsx` |
| `delayRender` / `continueRender` | `packages/core/src/delay-render.ts` |
| `render/render.ts` | `packages/renderer/src/render-frames.ts` |
| 草稿层 | Editor Starter(建在核心之上) |

## 下一步可以进阶的方向

- `<Audio>` / `<Video>`:收集音轨信息,导出时用 FFmpeg 混音(不能靠截图)。
- 图片资源 + `delayRender`:等待图片加载完再截图。
- 并发渲染:开多个页面分段渲染 0–N / N–2N 帧再拼接。
- 可视化编辑:让 Studio 能拖拽修改草稿 JSON。
- Player 组件:把预览封装成可嵌入任意页面的 `<Player>`。
```
